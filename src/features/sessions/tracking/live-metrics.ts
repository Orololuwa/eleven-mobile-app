import type { TrackingPointRow } from './types';

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

export const haversineMetres = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
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

  const distanceM = activePoints.reduce((sum, point, index) => {
    if (index === 0) return sum;
    const prev = activePoints[index - 1];
    return sum + haversineMetres(prev, point);
  }, 0);

  const topSpeedKmh = activePoints.reduce((max, point) => Math.max(max, point.speed_kmh ?? 0), 0);

  return { distanceKm: distanceM / 1000, topSpeedKmh };
};

export const formatDistance = ({ km, unit }: { km: number; unit: 'km' | 'mi' }) => {
  const value = unit === 'mi' ? km * 0.621371 : km;
  return value.toFixed(1);
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
  if (accuracyM == null) return { label: 'GPS ▮ WEAK', strength: 1 };
  if (accuracyM <= 10) return { label: `GPS ▮▮▮ ±${Math.round(accuracyM)} M`, strength: 3 };
  if (accuracyM <= 20) return { label: `GPS ▮▮ ±${Math.round(accuracyM)} M`, strength: 2 };
  return { label: 'GPS ▮ WEAK', strength: 1 };
};
