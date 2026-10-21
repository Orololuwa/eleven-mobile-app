import { describe, expect, it } from 'vitest';
import { scaleAtLatitude } from '../tracking/geodesic';
import { computeSessionMetrics, dopplerReferenceDistanceM } from './compute-session-metrics';
import type { ComputationInput, ComputationPoint, ComputationSegment } from './types';

const scale = scaleAtLatitude(6.45);
const origin = Date.parse('2026-08-09T10:00:00.000Z');

const at = (seconds: number) => new Date(origin + seconds * 1000).toISOString();

const latFor = (metresNorth: number) => 6.45 + metresNorth / scale.mPerDegLat;

const segment = ({
  id,
  index,
  start,
  end,
}: {
  id: string;
  index: number;
  start: number;
  end: number;
}): ComputationSegment => ({
  id,
  segmentIndex: index,
  startedAt: at(start),
  endedAt: at(end),
});

const fix = ({
  segmentId,
  t,
  metresNorth,
  speedKmh = 8,
  speedAccuracyMps = 1,
  horizontalAccuracyM = 5,
}: {
  segmentId: string;
  t: number;
  metresNorth: number;
  speedKmh?: number | null;
  speedAccuracyMps?: number | null;
  horizontalAccuracyM?: number | null;
}): ComputationPoint => ({
  segmentId,
  recordedAt: at(t),
  lat: latFor(metresNorth),
  lng: 3.4,
  speedKmh,
  speedAccuracyMps,
  horizontalAccuracyM,
});

const baseInput = (overrides: Partial<ComputationInput> = {}): ComputationInput => ({
  playStructure: 'halves',
  pitchId: 'pitch-1',
  corners: null,
  segments: [segment({ id: 's1', index: 1, start: 0, end: 120 })],
  pauses: [],
  points: [],
  massKg: 70,
  computedAt: at(0),
  ...overrides,
});

const trail = ({
  segmentId,
  startT,
  speeds,
  stepSec = 1,
  horizontalAccuracyM = 5,
}: {
  segmentId: string;
  startT: number;
  speeds: number[];
  stepSec?: number;
  horizontalAccuracyM?: number | null;
}) => {
  let metres = 0;
  return speeds.map((speedKmh, index) => {
    const point = fix({
      segmentId,
      t: startT + index * stepSec,
      metresNorth: metres,
      speedKmh,
      horizontalAccuracyM,
    });
    const next = speeds[index + 1];
    if (next != null) metres += (speedKmh / 3.6) * stepSec;
    return point;
  });
};

/** v2 rules — still computed at session end for comparison (Amendment 03 §4). */
const computeV2 = (input: ComputationInput) => computeSessionMetrics(input, { algorithm: 'v2' });

describe('computeSessionMetrics — v2 (comparison)', () => {
  it('sums segment spans and ignores the break and non-manual pauses', () => {
    const result = computeV2(
      baseInput({
        segments: [
          segment({ id: 'h1', index: 1, start: 0, end: 35 * 60 }),
          segment({ id: 'h2', index: 2, start: 45 * 60, end: 80 * 60 }),
        ],
        pauses: [
          {
            segmentId: 'h1',
            reason: 'manual',
            startedAt: at(10 * 60),
            endedAt: at(15 * 60),
          },
          {
            segmentId: 'h1',
            reason: 'gps_loss',
            startedAt: at(20 * 60),
            endedAt: at(26 * 60),
          },
        ],
      }),
    );

    expect(result.segments.map((row) => row.activeDurationSeconds)).toEqual([30 * 60, 35 * 60]);
    expect(result.activeDurationSeconds).toBe(65 * 60);
  });

  it('bridges short gaps and drops long ones, pauses, and implausible jumps', () => {
    const result = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 30 })],
        points: [
          fix({ segmentId: 's1', t: 0, metresNorth: 0, speedKmh: 10 }),
          fix({ segmentId: 's1', t: 3, metresNorth: 10, speedKmh: 10 }),
          fix({ segmentId: 's1', t: 11, metresNorth: 20, speedKmh: 10 }),
          fix({ segmentId: 's1', t: 14, metresNorth: 70, speedKmh: 10 }),
        ],
      }),
    );

    expect(result.distanceM).toBeCloseTo(10, 1);
    // Only the first 3 s pair is bridged; the rest of the 30 s segment is unmeasured.
    expect(result.gapSeconds).toBe(27);
    expect(result.segments[0]?.distanceM).toBeCloseTo(result.distanceM, 5);
  });

  it('does not bridge a manual pause or a segment boundary', () => {
    const result = computeV2(
      baseInput({
        segments: [
          segment({ id: 'h1', index: 1, start: 0, end: 40 }),
          segment({ id: 'h2', index: 2, start: 50, end: 80 }),
        ],
        pauses: [{ segmentId: 'h1', reason: 'manual', startedAt: at(10), endedAt: at(20) }],
        points: [
          fix({ segmentId: 'h1', t: 9, metresNorth: 0, speedKmh: 8 }),
          fix({ segmentId: 'h1', t: 21, metresNorth: 40, speedKmh: 8 }),
          fix({ segmentId: 'h2', t: 52, metresNorth: 40, speedKmh: 8 }),
          fix({ segmentId: 'h2', t: 54, metresNorth: 48, speedKmh: 8 }),
        ],
      }),
    );

    expect(result.segments[0]?.distanceM).toBe(0);
    expect(result.segments[1]?.distanceM).toBeCloseTo(8, 1);
    expect(result.distanceM).toBeCloseTo(result.segments[1]?.distanceM ?? 0, 5);
  });

  it('merges a one-sample dip into one sprint and keeps a real gap as two', () => {
    const merged = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 30 })],
        points: trail({
          segmentId: 's1',
          startT: 0,
          speeds: [17.8, 18.9, 16.7, 19.2, 18.4],
        }),
        corners: cornersForAxis(58),
      }),
    );

    expect(merged.speedBandBoundaries.sprint).toBe(17);
    expect(merged.sprints).toHaveLength(1);
    expect(merged.sprints[0]?.durationS).toBeCloseTo(4, 5);
    expect(merged.sprintCount).toBe(1);

    const split = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 30 })],
        points: [
          ...trail({ segmentId: 's1', startT: 0, speeds: [20, 20, 20] }),
          ...trail({ segmentId: 's1', startT: 12, speeds: [20, 20, 20] }),
        ],
        corners: cornersForAxis(58),
      }),
    );
    expect(split.sprints).toHaveLength(2);
  });

  it('caps chained dips at 2 seconds below the line', () => {
    const speedsAt = (start: number, seconds: number, speed: number) => {
      const count = Math.round(seconds) + 1;
      return trail({
        segmentId: 's1',
        startT: start,
        speeds: Array.from({ length: count }, () => speed),
      });
    };

    const result = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 40 })],
        corners: cornersForAxis(58),
        points: [
          ...speedsAt(0, 2.4, 20),
          ...speedsAt(3.2, 1.1, 20),
          ...speedsAt(4.9, 3, 20),
          ...speedsAt(8.8, 2, 20),
        ],
      }),
    );

    expect(result.sprints.length).toBeGreaterThan(1);
    expect(result.sprints[0]?.durationS).toBeGreaterThan(6);
  });

  it('uses futsal bands on a short pitch and full bands for training or a degenerate axis', () => {
    const futsal = computeV2(baseInput({ corners: cornersForAxis(40), playStructure: 'halves' }));
    const training = computeV2(
      baseInput({
        corners: cornersForAxis(40),
        playStructure: 'training_activities',
        pitchId: 'pitch-1',
      }),
    );
    const degenerate = computeV2(
      baseInput({ corners: cornersForAxis(5), playStructure: 'halves' }),
    );
    const noPitch = computeV2(baseInput({ corners: cornersForAxis(40), pitchId: null }));

    expect(futsal.speedBandBucket).toBe('futsal');
    expect(futsal.speedBandBoundaries.sprint).toBe(15);
    expect(training.speedBandBucket).toBe('full');
    expect(degenerate.speedBandBucket).toBe('full');
    expect(noPitch.speedBandBucket).toBe('full');
    expect(futsal.pitchLongAxisM).toBeCloseTo(40, 0);
  });

  it('marks a short session insufficient and suppresses speed when none was recorded', () => {
    const insufficient = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 40 })],
        points: trail({ segmentId: 's1', startT: 0, speeds: Array.from({ length: 30 }, () => 8) }),
      }),
    );
    expect(insufficient.dataQuality).toBe('insufficient');

    const noSpeed = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 30 })],
        points: [
          fix({ segmentId: 's1', t: 0, metresNorth: 0, speedKmh: null }),
          fix({ segmentId: 's1', t: 12, metresNorth: 30, speedKmh: null }),
        ],
      }),
    );
    expect(noSpeed.speedSource).toBe('none');
    expect(noSpeed.topSpeedKmh).toBeNull();
    expect(noSpeed.sprintCount).toBe(0);
    expect(noSpeed.zones).toEqual({ walk: 0, jog: 0, run: 0, high_run: 0, sprint: 0 });
    expect(noSpeed.distanceM).toBe(0);
  });

  it('falls back to position delta when OS speed fails the accuracy filter', () => {
    const result = computeV2(
      baseInput({
        points: [
          fix({
            segmentId: 's1',
            t: 0,
            metresNorth: 0,
            speedKmh: 18,
            speedAccuracyMps: 9,
          }),
          fix({
            segmentId: 's1',
            t: 1,
            metresNorth: 5,
            speedKmh: 18,
            speedAccuracyMps: 9,
          }),
        ],
      }),
    );
    expect(result.speedSource).toBe('position_delta');
    expect(result.distanceM).toBeCloseTo(5, 1);
  });

  it('keeps session totals equal to the sum of the segments', () => {
    const result = computeV2(
      baseInput({
        segments: [
          segment({ id: 'h1', index: 1, start: 0, end: 20 }),
          segment({ id: 'h2', index: 2, start: 30, end: 50 }),
        ],
        points: [
          ...trail({ segmentId: 'h1', startT: 0, speeds: [8, 8, 8, 8, 8] }),
          ...trail({ segmentId: 'h2', startT: 30, speeds: [12, 12, 12, 12] }),
        ],
        corners: cornersForAxis(100),
      }),
    );

    const sum = (pick: (row: (typeof result.segments)[number]) => number) =>
      result.segments.reduce((total, row) => total + pick(row), 0);

    expect(result.distanceM).toBeCloseTo(
      sum((row) => row.distanceM),
      5,
    );
    expect(result.activeDurationSeconds).toBe(sum((row) => row.activeDurationSeconds));
    expect(result.gapSeconds).toBe(sum((row) => row.gapSeconds));
    expect(result.sprintCount).toBe(sum((row) => row.sprintCount));
    expect(result.zones.walk).toBe(sum((row) => row.zones.walk));
    expect(result.caloriesKcal).toBe(sum((row) => row.caloriesKcal ?? 0));
    expect(result.algorithmVersion).toBe('v2');
  });

  const steady = (
    count: number,
    overrides: { stepSec?: number; horizontalAccuracyM?: number } = {},
  ) =>
    trail({
      segmentId: 's1',
      startT: 0,
      speeds: Array.from({ length: count }, () => 8),
      ...overrides,
    });

  it('stores nothing measurable from steady 30 m fixes and classifies them insufficient', () => {
    const result = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 180 })],
        points: steady(181, { horizontalAccuracyM: 30 }),
      }),
    );
    expect(result.distanceM).toBe(0);
    expect(result.acceptedFixCount).toBe(0);
    expect(result.continuityFixCount).toBe(181);
    expect(result.gapSeconds).toBe(180);
    expect(result.dataQuality).toBe('insufficient');
  });

  it('measures a fix at the 10 m quality gate and ignores one at 15 m', () => {
    const pair = (horizontalAccuracyM: number) =>
      computeV2(
        baseInput({
          points: [
            fix({ segmentId: 's1', t: 0, metresNorth: 0, horizontalAccuracyM }),
            fix({ segmentId: 's1', t: 1, metresNorth: 5, horizontalAccuracyM }),
          ],
        }),
      );
    expect(pair(10).distanceM).toBeCloseTo(5, 1);
    expect(pair(15).distanceM).toBe(0);
  });

  it('classifies on gap alone: a clean 0.5 Hz session is good', () => {
    const result = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 300 })],
        points: steady(151, { stepSec: 2 }),
      }),
    );
    expect(result.gapSeconds).toBe(0);
    expect(result.dataQuality).toBe('good');
  });

  it('marks a session estimated when sub-quality fixes leave a 5–25% gap', () => {
    const result = computeV2(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 200 })],
        points: [
          ...steady(181),
          ...trail({
            segmentId: 's1',
            startT: 181,
            speeds: Array.from({ length: 20 }, () => 8),
            horizontalAccuracyM: 30,
          }),
        ],
      }),
    );
    expect(result.gapSeconds).toBe(20);
    expect(result.dataQuality).toBe('estimated');
  });
});

const cornersForAxis = (metres: number) => ({
  end_a_corner_1: { lat: latFor(0), lng: 3.4 },
  end_a_corner_2: { lat: latFor(0), lng: 3.4001 },
  end_b_corner_1: { lat: latFor(metres), lng: 3.4 },
  end_b_corner_2: { lat: latFor(metres), lng: 3.4001 },
});

/** Deterministic Gaussian noise so replay numbers are stable. */
const noise = (seed: number) => {
  let state = seed;
  const uniform = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  return () => Math.sqrt(-2 * Math.log(uniform() || 1e-9)) * Math.cos(2 * Math.PI * uniform());
};

const lngFor = (metresEast: number) => 3.4 + metresEast / scale.mPerDegLng;

/** Straight run north at `speedsKmh`, positions scattered by `scatterM`, Doppler with `speedNoise`. */
const noisyTrail = ({
  speedsKmh,
  scatterM,
  horizontalAccuracyM = 5,
  speedAccuracyMps = 0.5,
  speedNoiseMps = 0.2,
  provider = 'gps',
  seed = 7,
  startT = 0,
}: {
  speedsKmh: number[];
  scatterM: number;
  horizontalAccuracyM?: number;
  speedAccuracyMps?: number;
  speedNoiseMps?: number;
  provider?: 'gps' | 'fused';
  seed?: number;
  startT?: number;
}) => {
  const gauss = noise(seed);
  let metres = 0;
  const points: ComputationPoint[] = speedsKmh.map((kmh, index) => {
    if (index > 0) metres += ((speedsKmh[index - 1]! + kmh) / 2 / 3.6) * 1;
    return {
      segmentId: 's1',
      recordedAt: at(startT + index),
      lat: latFor(metres + gauss() * scatterM),
      lng: lngFor(gauss() * scatterM),
      speedKmh: Math.max(0, kmh + gauss() * speedNoiseMps * 3.6),
      speedAccuracyMps,
      horizontalAccuracyM,
      provider,
    };
  });
  return { points, trueMetres: metres };
};

describe('computeSessionMetrics — v3 (Amendment 03)', () => {
  it('stores v3 by default', () => {
    expect(computeSessionMetrics(baseInput()).algorithmVersion).toBe('v3');
  });

  it('reads a steady jog within 3% of truth where the position sum inflates', () => {
    const { points, trueMetres } = noisyTrail({
      speedsKmh: Array.from({ length: 121 }, () => 8),
      scatterM: 4,
    });
    const input = baseInput({ points });
    const v3 = computeSessionMetrics(input);
    const v2 = computeSessionMetrics(input, { algorithm: 'v2' });
    expect(Math.abs(v3.distanceM - trueMetres) / trueMetres).toBeLessThan(0.03);
    expect(v2.distanceM).toBeGreaterThan(trueMetres * 1.2);
    expect(v3.speedSource).toBe('os');
    expect(v3.dataQuality).toBe('good');
  });

  it('adds almost nothing while standing in position scatter', () => {
    const { points } = noisyTrail({
      speedsKmh: Array.from({ length: 121 }, () => 0),
      scatterM: 5,
      speedNoiseMps: 0,
    });
    const input = baseInput({ points });
    expect(computeSessionMetrics(input).distanceM).toBeLessThan(15);
    expect(computeSessionMetrics(input, { algorithm: 'v2' }).distanceM).toBeGreaterThan(500);
  });

  it('tracks a sprint from standstill without the low-σ_a lag', () => {
    const speeds = Array.from({ length: 31 }, (_, t) =>
      t <= 10 ? 0 : t <= 13 ? (t - 10) * 8 : 24,
    );
    const { points, trueMetres } = noisyTrail({ speedsKmh: speeds, scatterM: 3 });
    const result = computeSessionMetrics(baseInput({ points }));
    expect(Math.abs(result.distanceM - trueMetres) / trueMetres).toBeLessThan(0.05);
    expect(result.topSpeedKmh).toBeGreaterThan(21);
    expect(result.topSpeedKmh).toBeLessThan(27);
  });

  it('stops counting once the position is no longer known through a long gap', () => {
    const before = noisyTrail({ speedsKmh: Array.from({ length: 30 }, () => 8), scatterM: 3 });
    const after = noisyTrail({
      speedsKmh: Array.from({ length: 30 }, () => 8),
      scatterM: 3,
      startT: 49,
      seed: 9,
    });
    const result = computeSessionMetrics(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 79 })],
        points: [...before.points, ...after.points],
      }),
    );
    // 20 s silence: the 20 s interval is not bridged, so roughly 58 s of jogging is measured.
    expect(result.distanceM).toBeLessThan((58 * 8) / 3.6 + 15);
    expect(result.gapSeconds).toBeGreaterThanOrEqual(19);
  });

  it('measures nothing across a manual pause', () => {
    const { points } = noisyTrail({ speedsKmh: Array.from({ length: 61 }, () => 8), scatterM: 3 });
    const result = computeSessionMetrics(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 60 })],
        points,
        pauses: [{ segmentId: 's1', reason: 'manual', startedAt: at(20), endedAt: at(40) }],
      }),
    );
    const unpaused = computeSessionMetrics(
      baseInput({ segments: [segment({ id: 's1', index: 1, start: 0, end: 60 })], points }),
    );
    expect(result.distanceM).toBeLessThan(unpaused.distanceM * 0.75);
  });

  it('weights a fused fix by what it is, not what it claims (C4)', () => {
    const { points } = noisyTrail({
      speedsKmh: Array.from({ length: 61 }, () => 0),
      scatterM: 0.5,
    });
    // Wi-Fi fallback: 10 m off while claiming 4 m — inside the outlier gate if believed, so only
    // provenance can weight it down. Play Services' flat 1.5 m/s speed accuracy.
    const jumped = points.map((point, index) =>
      index % 10 === 5
        ? { ...point, lat: latFor(10), speedKmh: 0, speedAccuracyMps: 1.5, horizontalAccuracyM: 4 }
        : point,
    );
    const asGps = computeSessionMetrics(baseInput({ points: jumped }));
    const asFused = computeSessionMetrics(
      baseInput({
        points: jumped.map((point, index) =>
          index % 10 === 5 ? { ...point, provider: 'fused' as const } : point,
        ),
      }),
    );
    expect(asFused.distanceM).toBeLessThan(asGps.distanceM);
    expect(asFused.distanceM).toBeLessThan(5);
  });

  it('keeps live (forward only) and summary (smoothed) close on a clean jog', () => {
    const { points } = noisyTrail({
      speedsKmh: Array.from({ length: 121 }, () => 10),
      scatterM: 3,
    });
    const input = baseInput({ points });
    const summary = computeSessionMetrics(input);
    const live = computeSessionMetrics(input, { smooth: false });
    expect(Math.abs(summary.distanceM - live.distanceM) / summary.distanceM).toBeLessThan(0.03);
  });

  it('integrates Doppler for the reference distance', () => {
    const { points, trueMetres } = noisyTrail({
      speedsKmh: Array.from({ length: 61 }, () => 9),
      scatterM: 5,
      speedNoiseMps: 0,
    });
    expect(dopplerReferenceDistanceM(baseInput({ points }))).toBeCloseTo(trueMetres, 0);
  });
});
