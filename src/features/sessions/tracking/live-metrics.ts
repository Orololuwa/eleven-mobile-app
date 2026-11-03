import { computeSessionMetrics } from '../summary/compute-session-metrics';
import {
  GAP_BRIDGE_MAX_SECONDS,
  QUALITY_INSUFFICIENT_GAP,
  QUALITY_MIN_ACTIVE_SECONDS,
} from '../summary/constants';
import type { ComputationInput, DataQuality } from '../summary/types';
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

/**
 * What the live readout is decided from: the numbers so far plus the newest fixes. Built by the
 * full pass (`computeLiveReadout`) or the incremental one (live-tracker) — same decisions either way.
 */
export type LiveReadoutBasis = {
  /** The open segment's (or, between segments, the session's) distance and top speed. */
  distanceM: number;
  topSpeedKmh: number | null;
  /** Session-level, as the summary would classify it now. */
  activeDurationSeconds: number;
  gapSeconds: number;
  dataQuality: DataQuality;
  /** Stored fixes within the live gate. */
  liveQualityFixCount: number;
  /** Recorded times (ms) of the newest two of them, oldest first. */
  recentFixTimesMs: number[];
};

/** Newest two of `timesMs`, oldest first — what `isMeasuringNow` needs from the trace. */
export const newestTwo = (timesMs: number[]) => [...timesMs].sort((a, b) => a - b).slice(-2);

/**
 * True when the latest two live-quality fixes are fresh and close enough to bridge (0.5 §3.3).
 * Uses the live gate (continuity-aligned), not the stricter summary quality gate.
 */
export const isMeasuringNow = ({
  recentFixTimesMs,
  nowMs = Date.now(),
  latestFix,
}: {
  recentFixTimesMs: number[];
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

  const [previous, latest] = newestTwo(recentFixTimesMs);
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
  basis,
  nowMs,
  latestFix,
}: {
  basis: LiveReadoutBasis;
  nowMs: number;
  /** `undefined` skips the feed check (unit tests). `null` means no fix has arrived. */
  latestFix?: LatestFix | null;
}): LiveSignal => {
  const { activeDurationSeconds, gapSeconds } = basis;
  const isLockingOn =
    activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS && basis.liveQualityFixCount < 2;

  if (latestFix !== undefined && isFixFeedStale({ fix: latestFix, nowMs })) {
    // Cold start before the first OS delivery still reads as settling, not offline.
    if (latestFix == null && activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS) {
      return 'settling';
    }
    return 'offline';
  }

  if (isLockingOn) return 'settling';
  if (!isMeasuringNow({ recentFixTimesMs: basis.recentFixTimesMs, nowMs, latestFix })) {
    return 'poor';
  }

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

/** Live HUD readout from a basis — the feed check, then the summary's quality classification. */
export const readoutFromBasis = ({
  basis,
  nowMs,
  latestFix,
}: {
  basis: LiveReadoutBasis;
  nowMs: number;
  /** Newest OS fix. When stale, signal is `offline` even if earlier metrics look fine. */
  latestFix?: LatestFix | null;
}): LiveMetrics => {
  const distanceKm = basis.distanceM / 1000;
  const topSpeedKmh = basis.topSpeedKmh ?? 0;

  if (latestFix !== undefined && isFixFeedStale({ fix: latestFix, nowMs })) {
    const coldStart = latestFix == null && basis.activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS;
    if (!coldStart) {
      return { distanceKm, topSpeedKmh, signal: 'offline' };
    }
  }

  // Session-level `estimated` is about cumulative gap — do not show SIGNAL WEAK while a fresh
  // summary-quality fix is arriving (e.g. ±3–5 m).
  let signal: LiveSignal;
  if (basis.dataQuality === 'insufficient') {
    signal = insufficientSignal({ basis, nowMs, latestFix });
  } else if (
    isMeasuringNow({ recentFixTimesMs: basis.recentFixTimesMs, nowMs, latestFix }) &&
    latestFix != null &&
    passesQualityGate(latestFix.accuracyM)
  ) {
    signal = 'good';
  } else {
    signal = basis.dataQuality;
  }

  return { distanceKm, topSpeedKmh, signal };
};

/**
 * Live HUD readout over the session so far, as one full pass: the same v3 filter as the summary
 * over the same admitted (continuity-grade) fixes, forward pass only (Amendment 03 C5). The HUD
 * runs the incremental equivalent (live-tracker); this is its reference.
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
  // v3 forward pass only — the summary adds the RTS smoother (Amendment 03 C5).
  const computed = computeSessionMetrics(input, { smooth: false });
  const segment = segmentId
    ? computed.segments.find((row) => row.segmentId === segmentId)
    : undefined;
  const liveQualityTimes = input.points
    .filter((point) => passesLiveQualityGate(point.horizontalAccuracyM))
    .map((point) => Date.parse(point.recordedAt));
  return readoutFromBasis({
    basis: {
      distanceM: segment ? segment.distanceM : computed.distanceM,
      topSpeedKmh: segment ? segment.topSpeedKmh : computed.topSpeedKmh,
      activeDurationSeconds: computed.activeDurationSeconds,
      gapSeconds: computed.gapSeconds,
      dataQuality: computed.dataQuality,
      liveQualityFixCount: liveQualityTimes.length,
      recentFixTimesMs: newestTwo(liveQualityTimes),
    },
    nowMs: input.computedAt ? Date.parse(input.computedAt) : Date.now(),
    latestFix,
  });
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
