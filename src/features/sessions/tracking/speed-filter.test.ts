import { describe, expect, it } from 'vitest';
import { determineTopSpeedKmh } from './speed-filter';

const METRES_PER_DEG_LAT = 111_320;

const offsetLat = ({ lat, metresNorth }: { lat: number; metresNorth: number }) =>
  lat + metresNorth / METRES_PER_DEG_LAT;

const point = ({
  tSec,
  speedKmh,
  lat = 6.45,
  lng = 3.39,
  speedAccuracyMps = 1.0,
  horizontalAccuracyM = 5,
  metresNorth = 0,
}: {
  tSec: number;
  speedKmh: number | null;
  lat?: number;
  lng?: number;
  speedAccuracyMps?: number | null;
  horizontalAccuracyM?: number | null;
  metresNorth?: number;
}) => ({
  recorded_at: new Date(Date.UTC(2026, 0, 1, 12, 0, tSec)).toISOString(),
  lat: offsetLat({ lat, metresNorth }),
  lng,
  speed_kmh: speedKmh,
  speed_accuracy_mps: speedAccuracyMps,
  horizontal_accuracy_m: horizontalAccuracyM,
});

/**
 * Place points so position-delta speed matches an implied constant speed over each interval.
 * `positionScale` multiplies the movement to simulate position noise against OS speed.
 */
const trailAtSpeed = ({
  speedsKmh,
  intervalSec = 1,
  speedAccuracyMps = 1.0,
  horizontalAccuracyM = 5,
  positionScale = 1,
}: {
  speedsKmh: number[];
  intervalSec?: number;
  speedAccuracyMps?: number | null;
  horizontalAccuracyM?: number | null;
  positionScale?: number;
}) => {
  let metresNorth = 0;
  return speedsKmh.map((speedKmh, index) => {
    if (index > 0) {
      const intervalAverage = (speedsKmh[index - 1] + speedKmh) / 2;
      metresNorth += (intervalAverage / 3.6) * intervalSec * positionScale;
    }
    return point({
      tSec: index * intervalSec,
      speedKmh,
      metresNorth,
      speedAccuracyMps,
      horizontalAccuracyM,
    });
  });
};

describe('determineTopSpeedKmh', () => {
  it('F3 passes acceleration when compared to interval-average OS speed', () => {
    // Standstill → 30 km/h over 3s covering ~12.5m (spec worked example).
    // Delta ≈ 15 km/h; average OS ≈ 15 km/h → pass. Current-only would be 50% and reject.
    const points = [
      point({ tSec: 0, speedKmh: 0.1, metresNorth: 0 }),
      point({ tSec: 3, speedKmh: 30, metresNorth: 12.5 }),
      point({ tSec: 6, speedKmh: 30, metresNorth: 12.5 + 25 }),
    ];
    expect(determineTopSpeedKmh(points)).toBe(30);
  });

  it('F3 rejects Doppler glitch when delta-speed is wildly below averaged OS speed', () => {
    // Prev 8 km/h, current 38 → average 23; delta ≈ 8 km/h (< 50% of 23).
    const points = [
      point({ tSec: 0, speedKmh: 8, metresNorth: 0 }),
      point({ tSec: 1, speedKmh: 38, metresNorth: 8 / 3.6 }),
      point({ tSec: 4, speedKmh: 38, metresNorth: 8 / 3.6 + 38 / 3.6 }),
      point({ tSec: 7, speedKmh: 38, metresNorth: 8 / 3.6 + (2 * 38) / 3.6 }),
    ];
    expect(determineTopSpeedKmh(points)).toBe(0);
  });

  it('F4 records max within confirmed band (29.5 / 30 / 31 → 31)', () => {
    const points = trailAtSpeed({ speedsKmh: [29.5, 30, 31], intervalSec: 1.5 });
    expect(determineTopSpeedKmh(points)).toBe(31);
  });

  it('F4 fixed anchor rejects ratchet climb (29.5 → 33 → 37)', () => {
    // 33 is within 15% of 29.5 and confirms peak 33; 37 is outside the band and
    // opens a new unconfirmed window (no second corroborating fix).
    const points = trailAtSpeed({ speedsKmh: [29.5, 33, 37], intervalSec: 3 });
    expect(determineTopSpeedKmh(points)).toBe(33);
  });

  it('F1 is skipped when speed_accuracy_mps is null', () => {
    const points = trailAtSpeed({
      speedsKmh: [28, 28.5, 29],
      intervalSec: 1.5,
      speedAccuracyMps: null,
    });
    expect(determineTopSpeedKmh(points)).toBe(29);
  });

  it('F1 rejects when speed_accuracy_mps exceeds 2.0', () => {
    const points = trailAtSpeed({
      speedsKmh: [28, 28.5, 29],
      intervalSec: 1.5,
      speedAccuracyMps: 2.5,
    });
    expect(determineTopSpeedKmh(points)).toBe(0);
  });

  it('F1 rejects a reading over the 10 m quality gate even when F3 corroborates it', () => {
    const points = trailAtSpeed({
      speedsKmh: [28, 28.5, 29],
      intervalSec: 1.5,
      horizontalAccuracyM: 15,
    });
    expect(determineTopSpeedKmh(points)).toBe(0);
  });

  it('F1 accepts a reading exactly at the 10 m quality gate', () => {
    const points = trailAtSpeed({
      speedsKmh: [28, 28.5, 29],
      intervalSec: 1.5,
      horizontalAccuracyM: 10,
    });
    expect(determineTopSpeedKmh(points)).toBe(29);
  });

  it('F1 rejects a reading with no horizontal accuracy', () => {
    const points = trailAtSpeed({
      speedsKmh: [28, 28.5, 29],
      intervalSec: 1.5,
      horizontalAccuracyM: null,
    });
    expect(determineTopSpeedKmh(points)).toBe(0);
  });

  it('F3 rejects a position jump when delta-speed is above 200% of averaged OS speed', () => {
    const points = trailAtSpeed({
      speedsKmh: [10, 10, 10, 10],
      intervalSec: 1.5,
      positionScale: 3,
    });
    expect(determineTopSpeedKmh(points)).toBe(0);
  });

  it('F3 passes position movement within 200% of averaged OS speed', () => {
    const points = trailAtSpeed({
      speedsKmh: [10, 10, 10, 10],
      intervalSec: 1.5,
      positionScale: 1.8,
    });
    expect(determineTopSpeedKmh(points)).toBe(10);
  });

  it('F2 rejects readings at or above 40 km/h', () => {
    const points = trailAtSpeed({ speedsKmh: [40, 40, 40], intervalSec: 1.5 });
    expect(determineTopSpeedKmh(points)).toBe(0);
  });

  it('single fix does not set a record', () => {
    expect(determineTopSpeedKmh([point({ tSec: 0, speedKmh: 32 })])).toBe(0);
  });

  it('sub-3s window does not set a record even with 2 fixes', () => {
    const points = trailAtSpeed({ speedsKmh: [30, 30.5], intervalSec: 1 });
    expect(determineTopSpeedKmh(points)).toBe(0);
  });

  it('2 fixes spanning ≥3s confirms the peak', () => {
    const points = trailAtSpeed({ speedsKmh: [30, 31], intervalSec: 3 });
    expect(determineTopSpeedKmh(points)).toBe(31);
  });
});
