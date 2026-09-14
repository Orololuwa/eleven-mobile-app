import {
  SPEED_ACCURACY_MAX_MPS,
  SPEED_CROSSCHECK_MIN_RATIO,
  TOP_SPEED_BAND_RATIO,
  TOP_SPEED_CEILING_KMH,
  TOP_SPEED_MIN_FIXES,
  TOP_SPEED_SUSTAINED_MS,
} from './constants';
import type { TrackingPointRow } from './types';

type SpeedPoint = Pick<
  TrackingPointRow,
  'recorded_at' | 'lat' | 'lng' | 'speed_kmh' | 'speed_accuracy_mps'
>;

type WindowState = {
  anchorKmh: number;
  startedAtMs: number;
  speeds: number[];
};

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

const haversineMetres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

const passesF1 = (point: SpeedPoint) =>
  point.speed_accuracy_mps == null || point.speed_accuracy_mps <= SPEED_ACCURACY_MAX_MPS;

const passesF2 = (speedKmh: number) => speedKmh < TOP_SPEED_CEILING_KMH;

const passesF3 = ({ point, prev }: { point: SpeedPoint; prev: SpeedPoint | null }): boolean => {
  if (!prev || prev.speed_kmh == null || point.speed_kmh == null) return true;

  const elapsedSec =
    (new Date(point.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
  if (elapsedSec <= 0) return true;

  const deltaSpeedKmh = (haversineMetres(prev, point) / elapsedSec) * 3.6;
  const averagedOsKmh = (prev.speed_kmh + point.speed_kmh) / 2;
  if (averagedOsKmh <= 0) return true;

  return deltaSpeedKmh >= averagedOsKmh * SPEED_CROSSCHECK_MIN_RATIO;
};

const withinBand = ({ readingKmh, anchorKmh }: { readingKmh: number; anchorKmh: number }) =>
  Math.abs(readingKmh - anchorKmh) / anchorKmh <= TOP_SPEED_BAND_RATIO;

const windowPeak = (window: WindowState) => Math.max(...window.speeds);

const isConfirmed = (window: WindowState, atMs: number) =>
  window.speeds.length >= TOP_SPEED_MIN_FIXES &&
  atMs - window.startedAtMs >= TOP_SPEED_SUSTAINED_MS;

/**
 * Shared top-speed determination (0.42): F1–F4 over accepted track points.
 * Live HUD passes the prefix so far; post-session (0.5) can pass the full trace.
 */
export const determineTopSpeedKmh = (points: SpeedPoint[]): number => {
  let topSpeedKmh = 0;
  let openWindow: WindowState | null = null;
  let prev: SpeedPoint | null = null;

  for (const point of points) {
    const speedKmh = point.speed_kmh;
    const isCandidate =
      speedKmh != null &&
      speedKmh > 0 &&
      passesF1(point) &&
      passesF2(speedKmh) &&
      passesF3({ point, prev });

    if (isCandidate && speedKmh != null) {
      const recordedAtMs = new Date(point.recorded_at).getTime();

      if (!openWindow) {
        openWindow = { anchorKmh: speedKmh, startedAtMs: recordedAtMs, speeds: [speedKmh] };
      } else if (withinBand({ readingKmh: speedKmh, anchorKmh: openWindow.anchorKmh })) {
        const nextWindow: WindowState = {
          anchorKmh: openWindow.anchorKmh,
          startedAtMs: openWindow.startedAtMs,
          speeds: [...openWindow.speeds, speedKmh],
        };
        openWindow = nextWindow;
        if (isConfirmed(nextWindow, recordedAtMs)) {
          topSpeedKmh = Math.max(topSpeedKmh, windowPeak(nextWindow));
        }
      } else {
        openWindow = { anchorKmh: speedKmh, startedAtMs: recordedAtMs, speeds: [speedKmh] };
      }
    }

    prev = point;
  }

  return topSpeedKmh;
};
