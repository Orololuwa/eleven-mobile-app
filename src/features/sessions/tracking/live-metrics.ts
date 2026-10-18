import { computeSessionMetrics } from '../summary/compute-session-metrics';
import {
  GAP_BRIDGE_MAX_SECONDS,
  QUALITY_INSUFFICIENT_GAP,
  QUALITY_MIN_ACTIVE_SECONDS,
} from '../summary/constants';
import type { ComputationInput, ComputedSessionMetrics } from '../summary/types';
import { LIVE_SIGNAL_SETTLE_SECONDS } from './constants';
import { isFixFeedStale } from './fix-feed';
import { passesContinuityGate, passesLiveQualityGate, passesQualityGate } from './fix-gates';
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
 * True when the latest two live-quality fixes are fresh and close enough to bridge (0.5 §3.3).
 * Uses the live gate (continuity-aligned), not the stricter summary quality gate.
 */
export const isMeasuringNow = ({
  points,
  nowMs = Date.now(),
  latestFix,
}: {
  points: ComputationInput['points'];
  nowMs?: number;
  /** When the OS feed is fresh and live-quality, treat as measuring even if DB is one tick behind. */
  latestFix?: LatestFix | null;
}) => {
  const bridgeMs = GAP_BRIDGE_MAX_SECONDS * 1000;
  if (
    latestFix != null &&
    !isFixFeedStale({ fix: latestFix, nowMs, staleMs: bridgeMs }) &&
    passesLiveQualityGate(latestFix.accuracyM)
  ) {
    return true;
  }

  const [previous, latest] = points
    .filter((point) => passesLiveQualityGate(point.horizontalAccuracyM))
    .map(msOf)
    .sort((a, b) => a - b)
    .slice(-2);
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
    input.points.filter((point) => passesLiveQualityGate(point.horizontalAccuracyM)).length < 2;

  if (latestFix !== undefined && isFixFeedStale({ fix: latestFix, nowMs })) {
    // Cold start before the first OS delivery still reads as settling, not offline.
    if (latestFix == null && activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS) {
      return 'settling';
    }
    return 'offline';
  }

  if (isLockingOn) return 'settling';
  if (!isMeasuringNow({ points: input.points, nowMs, latestFix })) return 'poor';

  // Summary floors (2 min / 120 fixes) keep dataQuality `insufficient` — that must not keep the
  // HUD on "early estimates" for minutes while a clean feed is already measuring.
  if (
    activeDurationSeconds >= QUALITY_MIN_ACTIVE_SECONDS &&
    gapSeconds / activeDurationSeconds > QUALITY_INSUFFICIENT_GAP
  ) {
    return 'recovering';
  }
  if (
    latestFix != null &&
    !passesQualityGate(latestFix.accuracyM) &&
    passesLiveQualityGate(latestFix.accuracyM)
  ) {
    return 'estimated';
  }
  return 'good';
};

/**
 * Live HUD readout over the session so far. Distance / top speed use the live quality gate
 * (continuity-aligned) so stored fixes feed the display; session summary still uses ≤10 m.
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
  const computed = computeSessionMetrics(input, { passesQuality: passesLiveQualityGate });
  const segment = segmentId
    ? computed.segments.find((row) => row.segmentId === segmentId)
    : undefined;
  const distanceKm = (segment ? segment.distanceM : computed.distanceM) / 1000;
  const topSpeedKmh = (segment ? segment.topSpeedKmh : computed.topSpeedKmh) ?? 0;
  const nowMs = input.computedAt ? Date.parse(input.computedAt) : Date.now();

  if (latestFix !== undefined && isFixFeedStale({ fix: latestFix, nowMs })) {
    const coldStart =
      latestFix == null && computed.activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS;
    if (!coldStart) {
      return { distanceKm, topSpeedKmh, signal: 'offline' };
    }
  }

  // Session-level `estimated` is about cumulative gap — do not show SIGNAL WEAK while a fresh
  // summary-quality fix is arriving (e.g. ±3–5 m).
  let signal: LiveSignal;
  if (computed.dataQuality === 'insufficient') {
    signal = insufficientSignal({ input, computed, latestFix });
  } else if (
    isMeasuringNow({ points: input.points, nowMs, latestFix }) &&
    latestFix != null &&
    passesQualityGate(latestFix.accuracyM)
  ) {
    signal = 'good';
  } else {
    signal = computed.dataQuality;
  }

  return { distanceKm, topSpeedKmh, signal };
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
  if (passesLiveQualityGate(accuracyM) || passesContinuityGate(accuracyM))
    return { label: `GPS ▮▮ ±${Math.round(accuracyM)} M`, strength: 2 };
  return { label: `GPS ▮ WEAK ±${Math.round(accuracyM)} M`, strength: 1 };
};
