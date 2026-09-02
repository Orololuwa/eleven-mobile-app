import {
  DOWNSAMPLE_HIGH_SPEED_KMH,
  DOWNSAMPLE_LOW_ACTIVITY_INTERVAL_MS,
  DOWNSAMPLE_SPEED_JUMP_MS,
} from './constants';
import type { TrackingPointRow } from './types';

const speedJumpMs = (prev: TrackingPointRow | null, current: TrackingPointRow) => {
  if (prev?.speed_kmh == null || current.speed_kmh == null) return 0;
  const prevMs = prev.speed_kmh / 3.6;
  const currMs = current.speed_kmh / 3.6;
  return Math.abs(currMs - prevMs);
};

const isHighActivity = (prev: TrackingPointRow | null, point: TrackingPointRow) =>
  (point.speed_kmh ?? 0) >= DOWNSAMPLE_HIGH_SPEED_KMH ||
  speedJumpMs(prev, point) >= DOWNSAMPLE_SPEED_JUMP_MS;

/** Adaptive downsample: keep all high-activity fixes; thin low-activity to ~1/4s. */
export const downsampleTrackPoints = (points: TrackingPointRow[]): TrackingPointRow[] => {
  if (points.length === 0) return [];

  return points.reduce<{ kept: TrackingPointRow[]; lastLowActivityMs: number | null }>(
    (acc, point, index) => {
      const prev = index > 0 ? points[index - 1] : null;
      const recordedMs = new Date(point.recorded_at).getTime();

      if (isHighActivity(prev, point)) {
        return { kept: [...acc.kept, point], lastLowActivityMs: acc.lastLowActivityMs };
      }

      if (
        acc.lastLowActivityMs == null ||
        recordedMs - acc.lastLowActivityMs >= DOWNSAMPLE_LOW_ACTIVITY_INTERVAL_MS
      ) {
        return { kept: [...acc.kept, point], lastLowActivityMs: recordedMs };
      }

      return acc;
    },
    { kept: [], lastLowActivityMs: null },
  ).kept;
};
