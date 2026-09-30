import type { TrackingPointRow } from './types';
import { planeMetres, scaleAtLatitude } from './geodesic';
import { determineTopSpeedKmh } from './speed-filter';

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

export const computeLiveMetrics = ({
  points,
  pausedRanges,
}: {
  points: TrackingPointRow[];
  pausedRanges: { started_at: string; ended_at: string | null }[];
}): { distanceKm: number; topSpeedKmh: number } => {
  const isPausedAt = (iso: string) => {
    const t = new Date(iso).getTime();
    return pausedRanges.some((range) => {
      const start = new Date(range.started_at).getTime();
      const end = range.ended_at ? new Date(range.ended_at).getTime() : Date.now();
      return t >= start && t <= end;
    });
  };

  const activePoints = points.filter((p) => !isPausedAt(p.recorded_at));

  const scale = scaleAtLatitude(activePoints[0]?.lat ?? 0);
  const distanceM = activePoints.reduce((sum, point, index) => {
    if (index === 0) return sum;
    const prev = activePoints[index - 1];
    if (!prev) return sum;
    return sum + planeMetres(prev, point, scale);
  }, 0);

  return { distanceKm: distanceM / 1000, topSpeedKmh: determineTopSpeedKmh(activePoints) };
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
  if (accuracyM <= 15) return { label: `GPS ▮▮▮ ±${Math.round(accuracyM)} M`, strength: 3 };
  if (accuracyM <= 40) return { label: `GPS ▮▮ ±${Math.round(accuracyM)} M`, strength: 2 };
  return { label: `GPS ▮ WEAK ±${Math.round(accuracyM)} M`, strength: 1 };
};
