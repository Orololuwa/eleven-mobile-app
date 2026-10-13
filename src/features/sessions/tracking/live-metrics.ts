import { computeSessionMetrics } from '../summary/compute-session-metrics';
import { QUALITY_INSUFFICIENT_GAP, QUALITY_MIN_ACTIVE_SECONDS } from '../summary/constants';
import type { ComputationInput } from '../summary/types';
import { LIVE_SIGNAL_SETTLE_SECONDS } from './constants';
import { passesContinuityGate, passesQualityGate } from './fix-gates';
import type { LiveMetrics } from './types';

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
 * Live HUD readout over the session so far. Classification and figures come from the summary's own
 * `computeSessionMetrics`, so the HUD never shows a number the summary would refuse to show.
 * Distance and top speed are for `segmentId` (session totals when null), or null when suppressed.
 */
export const computeLiveReadout = ({
  input,
  segmentId = null,
}: {
  input: ComputationInput;
  segmentId?: string | null;
}): LiveMetrics => {
  const computed = computeSessionMetrics(input);
  if (computed.dataQuality === 'insufficient') {
    const { activeDurationSeconds, gapSeconds } = computed;
    const isSettling =
      activeDurationSeconds < LIVE_SIGNAL_SETTLE_SECONDS ||
      (activeDurationSeconds < QUALITY_MIN_ACTIVE_SECONDS &&
        gapSeconds / activeDurationSeconds <= QUALITY_INSUFFICIENT_GAP);
    return { distanceKm: null, topSpeedKmh: null, signal: isSettling ? 'settling' : 'poor' };
  }

  const segment = segmentId
    ? computed.segments.find((row) => row.segmentId === segmentId)
    : undefined;
  const distanceM = segment ? segment.distanceM : computed.distanceM;
  const topSpeedKmh = segment ? segment.topSpeedKmh : computed.topSpeedKmh;
  return {
    distanceKm: distanceM / 1000,
    topSpeedKmh: topSpeedKmh ?? 0,
    signal: computed.dataQuality,
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
