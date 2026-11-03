import { describe, expect, it } from 'vitest';
import { scaleAtLatitude } from '../tracking/geodesic';
import {
  computeSessionMetrics,
  dopplerReferenceDistanceM,
  zeroVelocityFlags,
} from './compute-session-metrics';
import { strideFromSamples, type StrideEstimate } from './steps';
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
  it('stores v3.1 by default and reproduces v3 with sensors off', () => {
    expect(computeSessionMetrics(baseInput()).algorithmVersion).toBe('v3.1');
    expect(computeSessionMetrics(baseInput(), { sensors: false }).algorithmVersion).toBe('v3');
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

/** Attach a pedometer reading (cumulative, from a since-boot base) and accel variance to each fix. */
const withSensors = (
  points: ComputationPoint[],
  {
    stepsPerSecond,
    accelVariance,
    base = 41_000,
  }: {
    stepsPerSecond: number | ((secondsIn: number) => number);
    accelVariance: number | null;
    base?: number;
  },
): ComputationPoint[] => {
  const rate = typeof stepsPerSecond === 'number' ? () => stepsPerSecond : stepsPerSecond;
  let steps = base;
  let lastT = Date.parse(points[0]!.recordedAt);
  return points.map((point) => {
    const t = Date.parse(point.recordedAt);
    for (let s = lastT; s < t; s += 1000) steps += rate((s - origin) / 1000);
    lastT = t;
    return { ...point, stepCount: Math.floor(steps), accelVariance };
  });
};

const stride: StrideEstimate = { walkM: 0.7, runM: 1, walkLearned: true, runLearned: true };

describe('computeSessionMetrics — v3.1 motion sensors (Amendment 03 C2 / C3)', () => {
  const still = (overrides: Partial<{ speedNoiseMps: number; seed: number }> = {}) =>
    noisyTrail({
      speedsKmh: Array.from({ length: 121 }, () => 0),
      scatterM: 5,
      // The chip does not always pin 0 — a noisy Doppler that reads up to ~1 m/s at rest.
      speedNoiseMps: overrides.speedNoiseMps ?? 0.4,
      seed: overrides.seed ?? 11,
    }).points;

  it('votes stillness only when two of Doppler, steps and accelerometer agree', () => {
    const base: {
      speedKmh: number | null;
      stepCount: number | null;
      accelVariance: number | null;
    } = { speedKmh: 0, stepCount: 100, accelVariance: 0.01 };
    const series = (patch: Partial<typeof base>) =>
      Array.from({ length: 6 }, (_, t) => ({ atMs: t * 1000, ...base, ...patch }));
    expect(zeroVelocityFlags(series({})).slice(3)).toEqual([true, true, true]);
    // Doppler + accel (no pedometer): two votes.
    expect(zeroVelocityFlags(series({ stepCount: null })).at(-1)).toBe(true);
    // Steps + accel while Doppler reads walking pace: still two.
    expect(zeroVelocityFlags(series({ speedKmh: 4 })).at(-1)).toBe(true);
    // Accelerometer alone: never.
    expect(zeroVelocityFlags(series({ speedKmh: 4, stepCount: null })).at(-1)).toBe(false);
    // Doppler alone: never.
    expect(zeroVelocityFlags(series({ accelVariance: 2, stepCount: null })).at(-1)).toBe(false);
    // Doppler quiet for one fix is not sustained.
    const blip = series({ accelVariance: 2, stepCount: null }).map((point, t) => ({
      ...point,
      speedKmh: t === 5 ? 0 : 6,
    }));
    expect(zeroVelocityFlags(blip).at(-1)).toBe(false);
  });

  it('ZUPT removes the phantom distance of standing in scatter', () => {
    const points = withSensors(still(), { stepsPerSecond: 0, accelVariance: 0.005 });
    const input = baseInput({ points });
    const v31 = computeSessionMetrics(input);
    const v3 = computeSessionMetrics(input, { sensors: false });
    const live = computeSessionMetrics(input, { smooth: false });
    expect(v31.zuptFixCount).toBeGreaterThan(110);
    expect(v31.distanceM).toBeLessThan(1);
    expect(live.distanceM).toBeLessThan(1);
    expect(v3.distanceM).toBeGreaterThan(v31.distanceM + 5);
  });

  it('never applies ZUPT on one signal: a jog with a quiet accelerometer is unchanged', () => {
    const { points, trueMetres } = noisyTrail({
      speedsKmh: Array.from({ length: 121 }, () => 8),
      scatterM: 4,
    });
    // Armband phone: accelerometer reads quiet, but Doppler and steps both say moving.
    const input = baseInput({
      points: withSensors(points, { stepsPerSecond: 2.5, accelVariance: 0.01 }),
    });
    const v31 = computeSessionMetrics(input);
    expect(v31.zuptFixCount).toBe(0);
    expect(v31.distanceM).toBeCloseTo(
      computeSessionMetrics(input, { sensors: false }).distanceM,
      6,
    );
    expect(Math.abs(v31.distanceM - trueMetres) / trueMetres).toBeLessThan(0.03);
  });

  it('stops dead at a stoppage and picks the jog back up after it', () => {
    const speeds = Array.from({ length: 151 }, (_, t) => (t < 50 || t >= 110 ? 8 : 0));
    const { points, trueMetres } = noisyTrail({ speedsKmh: speeds, scatterM: 4, seed: 5 });
    const input = baseInput({
      segments: [segment({ id: 's1', index: 1, start: 0, end: 150 })],
      points: withSensors(points, {
        stepsPerSecond: (t) => (t < 50 || t >= 110 ? 2.5 : 0),
        accelVariance: null,
      }).map((point) => {
        const t = (Date.parse(point.recordedAt) - origin) / 1000;
        return { ...point, accelVariance: t < 50 || t >= 110 ? 3 : 0.005 };
      }),
    });
    const v31 = computeSessionMetrics(input);
    const v3 = computeSessionMetrics(input, { sensors: false });
    expect(v31.zuptFixCount).toBeGreaterThan(50);
    expect(Math.abs(v31.distanceM - trueMetres) / trueMetres).toBeLessThan(0.04);
    expect(v31.distanceM).toBeLessThanOrEqual(v3.distanceM + 1);
  });

  it('bridges a GPS gap with steps × stride — distance only, never coverage', () => {
    const before = noisyTrail({ speedsKmh: Array.from({ length: 30 }, () => 9), scatterM: 3 });
    const after = noisyTrail({
      speedsKmh: Array.from({ length: 30 }, () => 9),
      scatterM: 3,
      startT: 69,
      seed: 9,
    });
    // 40 s with no fix at all (> the 30 s filter reset): 2.6 steps/s = 104 steps at 156 spm.
    const points = withSensors([...before.points, ...after.points], {
      stepsPerSecond: 2.6,
      accelVariance: 3,
    });
    const input = baseInput({
      segments: [segment({ id: 's1', index: 1, start: 0, end: 98 })],
      points,
      stride,
    });
    const v31 = computeSessionMetrics(input);
    const v3 = computeSessionMetrics(input, { sensors: false });
    const gapSteps = points[30]!.stepCount! - points[29]!.stepCount!;
    expect(gapSteps).toBe(104);
    expect(v31.stepBridgedDistanceM).toBeCloseTo(gapSteps * stride.runM, 6);
    expect(v31.distanceM).toBeCloseTo(v3.distanceM + v31.stepBridgedDistanceM, 6);
    // Truth: 98 s at 2.5 m/s. Coverage (gap) still reports GPS honestly.
    expect(Math.abs(v31.distanceM - 98 * 2.5) / (98 * 2.5)).toBeLessThan(0.08);
    expect(v31.gapSeconds).toBe(v3.gapSeconds);
    expect(v31.sprintCount).toBe(0);
  });

  it('bridges nothing across a gap with no steps (standing) or across a manual pause', () => {
    const before = noisyTrail({ speedsKmh: Array.from({ length: 30 }, () => 9), scatterM: 3 });
    const after = noisyTrail({
      speedsKmh: Array.from({ length: 30 }, () => 9),
      scatterM: 3,
      startT: 69,
      seed: 9,
    });
    const gapRate = (t: number) => (t >= 29 && t < 69 ? 0 : 2.6);
    const standing = baseInput({
      segments: [segment({ id: 's1', index: 1, start: 0, end: 98 })],
      points: withSensors([...before.points, ...after.points], {
        stepsPerSecond: gapRate,
        accelVariance: 3,
      }),
      stride,
    });
    expect(computeSessionMetrics(standing).stepBridgedDistanceM).toBe(0);

    const paused = baseInput({
      segments: [segment({ id: 's1', index: 1, start: 0, end: 98 })],
      points: withSensors([...before.points, ...after.points], {
        stepsPerSecond: 2.6,
        accelVariance: 3,
      }),
      pauses: [{ segmentId: 's1', reason: 'manual', startedAt: at(35), endedAt: at(60) }],
      stride,
    });
    expect(computeSessionMetrics(paused).stepBridgedDistanceM).toBe(0);
  });

  it('measures a segment GPS never covered from its step count alone (C3.4)', () => {
    const input = baseInput({
      segments: [{ ...segment({ id: 's1', index: 1, start: 0, end: 600 }), stepCount: 1500 }],
      points: [],
      stride,
    });
    const result = computeSessionMetrics(input);
    // 150 spm → run stride.
    expect(result.distanceM).toBeCloseTo(1500 * stride.runM, 6);
    expect(result.stepBridgedDistanceM).toBe(result.distanceM);
    expect(result.stepCount).toBe(1500);
    expect(result.dataQuality).toBe('insufficient');
    expect(result.topSpeedKmh).toBeNull();
    expect(computeSessionMetrics(input, { sensors: false }).distanceM).toBe(0);
  });

  it('uses the population default stride until the player has one', () => {
    const input = baseInput({
      segments: [{ ...segment({ id: 's1', index: 1, start: 0, end: 600 }), stepCount: 600 }],
    });
    // 60 spm → walk band, default 0.7 m.
    expect(computeSessionMetrics(input).distanceM).toBeCloseTo(600 * 0.7, 6);
  });

  it('learns metres per step from GPS-measured stretches (C3.3)', () => {
    const { points } = noisyTrail({
      speedsKmh: Array.from({ length: 121 }, () => 8),
      scatterM: 4,
    });
    const result = computeSessionMetrics(
      baseInput({ points: withSensors(points, { stepsPerSecond: 2.5, accelVariance: 3 }) }),
    );
    const run = result.strideSamples.find((sample) => sample.band === 'run');
    expect(run).toBeDefined();
    expect(run!.steps).toBeGreaterThan(250);
    // 8 km/h at 2.5 steps/s = 0.889 m per step.
    expect(Math.abs(run!.metres / run!.steps - 8 / 3.6 / 2.5)).toBeLessThan(0.04);
    expect(result.strideSamples.find((sample) => sample.band === 'walk')).toBeUndefined();
  });

  it('ignores a counter that went backwards (reboot) instead of bridging with it', () => {
    const before = noisyTrail({ speedsKmh: Array.from({ length: 30 }, () => 9), scatterM: 3 });
    const after = noisyTrail({
      speedsKmh: Array.from({ length: 30 }, () => 9),
      scatterM: 3,
      startT: 69,
      seed: 9,
    });
    const points = [
      ...withSensors(before.points, { stepsPerSecond: 2.6, accelVariance: 3 }),
      ...withSensors(after.points, { stepsPerSecond: 2.6, accelVariance: 3, base: 10 }),
    ];
    const input = baseInput({
      segments: [segment({ id: 's1', index: 1, start: 0, end: 98 })],
      points,
      stride,
    });
    expect(computeSessionMetrics(input).stepBridgedDistanceM).toBe(0);
  });
});

describe('strideFromSamples (C3.3)', () => {
  it('keeps the population default until a band has enough steps behind it', () => {
    const stride = strideFromSamples([{ band: 'run', metres: 180, steps: 200 }]);
    expect(stride.runLearned).toBe(false);
    expect(stride.runM).toBe(0.95);
    expect(stride.walkM).toBe(0.7);
  });

  it('pools sessions per band and clamps an implausible stride', () => {
    const stride = strideFromSamples([
      { band: 'run', metres: 450, steps: 500 },
      { band: 'run', metres: 470, steps: 500 },
      { band: 'walk', metres: 2000, steps: 400 },
    ]);
    expect(stride.runLearned).toBe(true);
    expect(stride.runM).toBeCloseTo(0.92, 6);
    expect(stride.walkLearned).toBe(true);
    expect(stride.walkM).toBe(1.8);
  });
});
