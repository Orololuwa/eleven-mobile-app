import {
  SPEED_ACCURACY_MAX_MPS,
  SPEED_CROSSCHECK_MIN_RATIO,
  TOP_SPEED_BAND_RATIO,
  TOP_SPEED_CEILING_KMH,
  TOP_SPEED_MIN_FIXES,
  TOP_SPEED_SUSTAINED_MS,
} from './constants';
import { planeMetres, scaleAtLatitude, type DegreeScale } from './geodesic';
import type { TrackingPointRow } from './types';

type SpeedPoint = Pick<
  TrackingPointRow,
  'recorded_at' | 'lat' | 'lng' | 'speed_kmh' | 'speed_accuracy_mps'
>;

type WindowSample = { kmh: number; lat: number; lng: number };

type WindowState = {
  anchorKmh: number;
  startedAtMs: number;
  samples: WindowSample[];
};

export type TopSpeedPeak = { kmh: number; lat: number; lng: number };

const passesF1 = (point: SpeedPoint) =>
  point.speed_accuracy_mps == null || point.speed_accuracy_mps <= SPEED_ACCURACY_MAX_MPS;

const passesF2 = (speedKmh: number) => speedKmh < TOP_SPEED_CEILING_KMH;

const passesF3 = ({
  point,
  prev,
  scale,
}: {
  point: SpeedPoint;
  prev: SpeedPoint | null;
  scale: DegreeScale;
}): boolean => {
  if (!prev || prev.speed_kmh == null || point.speed_kmh == null) return true;

  const elapsedSec =
    (new Date(point.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
  if (elapsedSec <= 0) return true;

  const deltaSpeedKmh = (planeMetres(prev, point, scale) / elapsedSec) * 3.6;
  const averagedOsKmh = (prev.speed_kmh + point.speed_kmh) / 2;
  if (averagedOsKmh <= 0) return true;

  return deltaSpeedKmh >= averagedOsKmh * SPEED_CROSSCHECK_MIN_RATIO;
};

const withinBand = ({ readingKmh, anchorKmh }: { readingKmh: number; anchorKmh: number }) =>
  Math.abs(readingKmh - anchorKmh) / anchorKmh <= TOP_SPEED_BAND_RATIO;

const windowPeak = (window: WindowState) =>
  window.samples.reduce((best, sample) => (sample.kmh > best.kmh ? sample : best));

const isConfirmed = (window: WindowState, atMs: number) =>
  window.samples.length >= TOP_SPEED_MIN_FIXES &&
  atMs - window.startedAtMs >= TOP_SPEED_SUSTAINED_MS;

/**
 * F1–F4 over accepted fixes. Returns the confirmed peak and the fix that set it.
 * Live HUD uses the number; the summary copies the location before the trace is deleted.
 */
export const determineTopSpeedPeak = (points: SpeedPoint[]): TopSpeedPeak | null => {
  const scale = scaleAtLatitude(points[0]?.lat ?? 0);
  let top: TopSpeedPeak | null = null;
  let openWindow: WindowState | null = null;
  let prev: SpeedPoint | null = null;

  for (const point of points) {
    const speedKmh = point.speed_kmh;
    const isCandidate =
      speedKmh != null &&
      speedKmh > 0 &&
      passesF1(point) &&
      passesF2(speedKmh) &&
      passesF3({ point, prev, scale });

    if (isCandidate && speedKmh != null) {
      const recordedAtMs = new Date(point.recorded_at).getTime();
      const sample = { kmh: speedKmh, lat: point.lat, lng: point.lng };

      if (!openWindow) {
        openWindow = { anchorKmh: speedKmh, startedAtMs: recordedAtMs, samples: [sample] };
      } else if (withinBand({ readingKmh: speedKmh, anchorKmh: openWindow.anchorKmh })) {
        const nextWindow: WindowState = {
          anchorKmh: openWindow.anchorKmh,
          startedAtMs: openWindow.startedAtMs,
          samples: [...openWindow.samples, sample],
        };
        openWindow = nextWindow;
        if (isConfirmed(nextWindow, recordedAtMs)) {
          const peak = windowPeak(nextWindow);
          if (!top || peak.kmh > top.kmh) top = peak;
        }
      } else {
        openWindow = { anchorKmh: speedKmh, startedAtMs: recordedAtMs, samples: [sample] };
      }
    }

    prev = point;
  }

  return top;
};

export const determineTopSpeedKmh = (points: SpeedPoint[]): number =>
  determineTopSpeedPeak(points)?.kmh ?? 0;
