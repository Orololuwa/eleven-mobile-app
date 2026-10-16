import { computeSessionMetrics } from '../summary/compute-session-metrics';
import {
  GAP_BRIDGE_MAX_SECONDS,
  QUALITY_INSUFFICIENT_GAP,
  QUALITY_MIN_ACTIVE_SECONDS,
} from '../summary/constants';
import type { ComputationInput, ComputedSessionMetrics } from '../summary/types';
import { LIVE_SIGNAL_SETTLE_SECONDS } from './constants';
import { isFixFeedStale } from './fix-feed';
import { passesContinuityGate, passesQualityGate } from './fix-gates';
import type { LatestFix, LiveMetrics, LiveSignal } from './types';

export const elapsedSecondsFromPauses = ({
  startedAt,
  pausedRanges,
  nowMs = Date.now(),
}: {
  startedAt: string;
  pausedRanges: { started_at: string; ended_at: string | null }[];
  nowMs?: number;
}) => {
  const startMs = new Date(startedAt).getTime();
  const pausedMs = pausedRanges.reduce((sum, pause) => {
    const pauseStart = new Date(pause.started_at).getTime();
    const pauseEnd = pause.ended_at ? new Date(pause.ended_at).getTime() : nowMs;
    return sum + Math.max(0, pauseEnd - pauseStart);
  }, 0);
  return Math.max(0, Math.floor((nowMs - startMs - pausedMs) / 1000));
};

const msOf = (point: { recordedAt: string }) => Date.parse(point.recordedAt);

/**
 * True when the latest two quality fixes are fresh and close enough to bridge (0.5 §3.3), i.e. the
 * session is being measured right now. Accuracy alone is not enough: accurate fixes arriving more
 * than the bridge window apart measure nothing.
 */
export const isMeasuringNow = ({
  points,
  nowMs = Date.now(),
}: {
  points: ComputationInput['points'];
  nowMs?: number;
}) => {
  const [previous, latest] = points
    .filter((point) => passesQualityGate(point.horizontalAccuracyM))
    .map(msOf)
    .sort((a, b) => a - b)
    .slice(-2);
  const bridgeMs = GAP_BRIDGE_MAX_SECONDS * 1000;
  return (
    previous != null &&
    latest != null &&
    nowMs - latest <= bridgeMs &&
    latest - previous <= bridgeMs
  );
};

/** Accuracy of the latest fix, or null when it is too old to say anything about the signal now. */
export const currentFixAccuracyM = ({
  fix,
  nowMs = Date.now(),
}: {
  fix: { accuracyM: number | null; atMs: number } | null;
  nowMs?: number;
}) => {
  if (!fix) return null;
  return nowMs - fix.atMs <= GAP_BRIDGE_MAX_SECONDS * 1000 ? fix.accuracyM : null;
};

const insufficientSignal = ({
  input,
  computed,
  latestFix,
}: {
  input: ComputationInput;
  computed: ComputedSessionMetrics;
  /** `undefined` skips the feed check (unit tests). `null` means no fix has arrived. */
  latestFix?: LatestFix | null;
}): LiveSignal => {
  const { activeDurationSeconds, gapSeconds } = computed;
  const nowMs = input.computedAt ? Date.parse(input.computedAt) : Date.now();
  const isLockingOn =
    activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS &&
    input.points.filter((point) => passesQualityGate(point.horizontalAccuracyM)).length < 2;

  if (latestFix !== undefined && isFixFeedStale({ fix: latestFix, nowMs })) {
    // Cold start before the first delivery still reads as settling, not offline.
    if (isLockingOn && latestFix == null) return 'settling';
    return 'offline';
  }

  if (isLockingOn) return 'settling';
  if (!isMeasuringNow({ points: input.points, nowMs })) return 'poor';
  return activeDurationSeconds >= QUALITY_MIN_ACTIVE_SECONDS &&
    gapSeconds / activeDurationSeconds > QUALITY_INSUFFICIENT_GAP
    ? 'recovering'
    : 'settling';
};

/**
 * Live HUD readout over the session so far, from the summary's own `computeSessionMetrics`.
 * Distance and top speed (for `segmentId`, session totals when null) are always shown — they only
 * ever count quality-gated, bridged fixes. `signal` tells the player how far to trust them.
 */
export const computeLiveReadout = ({
  input,
  segmentId = null,
  latestFix,
}: {
  input: ComputationInput;
  segmentId?: string | null;
  /** Newest OS fix. When stale, signal is `offline` even if earlier metrics look fine. */
  latestFix?: LatestFix | null;
}): LiveMetrics => {
  const computed = computeSessionMetrics(input);
  const segment = segmentId
    ? computed.segments.find((row) => row.segmentId === segmentId)
    : undefined;
  const distanceKm = (segment ? segment.distanceM : computed.distanceM) / 1000;
  const topSpeedKmh = (segment ? segment.topSpeedKmh : computed.topSpeedKmh) ?? 0;
  const nowMs = input.computedAt ? Date.parse(input.computedAt) : Date.now();

  if (latestFix !== undefined && isFixFeedStale({ fix: latestFix, nowMs })) {
    const lockingOn =
      computed.activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS && latestFix == null;
    if (!lockingOn) {
      return { distanceKm, topSpeedKmh, signal: 'offline' };
    }
  }

  return {
    distanceKm,
    topSpeedKmh,
    signal:
      computed.dataQuality === 'insufficient'
        ? insufficientSignal({ input, computed, latestFix })
        : computed.dataQuality,
  };
};

export const formatDistance = ({ km, unit }: { km: number; unit: 'km' | 'mi' }) => {
  const value = unit === 'mi' ? km * 0.621371 : km;
  return value.toFixed(2);
};

export const formatSpeed = ({ kmh, unit }: { kmh: number; unit: 'km' | 'mi' }) => {
  const value = unit === 'mi' ? kmh * 0.621371 : kmh;
  return value.toFixed(1);
};

export const formatElapsed = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatElapsedLong = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const gpsStrengthBars = (accuracyM: number | null) => {
  if (accuracyM == null) return { label: 'GPS ▮ …', strength: 1 };
  if (passesQualityGate(accuracyM))
    return { label: `GPS ▮▮▮ ±${Math.round(accuracyM)} M`, strength: 3 };
  if (passesContinuityGate(accuracyM))
    return { label: `GPS ▮▮ ±${Math.round(accuracyM)} M`, strength: 2 };
  return { label: `GPS ▮ WEAK ±${Math.round(accuracyM)} M`, strength: 1 };
};
