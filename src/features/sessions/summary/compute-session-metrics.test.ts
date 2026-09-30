import { describe, expect, it } from 'vitest';
import { scaleAtLatitude } from '../tracking/geodesic';
import { computeSessionMetrics } from './compute-session-metrics';
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
}: {
  segmentId: string;
  startT: number;
  speeds: number[];
  stepSec?: number;
}) => {
  let metres = 0;
  return speeds.map((speedKmh, index) => {
    const point = fix({ segmentId, t: startT + index * stepSec, metresNorth: metres, speedKmh });
    const next = speeds[index + 1];
    if (next != null) metres += (speedKmh / 3.6) * stepSec;
    return point;
  });
};

describe('computeSessionMetrics', () => {
  it('sums segment spans and ignores the break and non-manual pauses', () => {
    const result = computeSessionMetrics(
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
    const result = computeSessionMetrics(
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
    expect(result.gapSeconds).toBe(11);
    expect(result.segments[0]?.distanceM).toBeCloseTo(result.distanceM, 5);
  });

  it('does not bridge a manual pause or a segment boundary', () => {
    const result = computeSessionMetrics(
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
    const merged = computeSessionMetrics(
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

    expect(merged.speedBandBoundaries.sprint_min_kmh).toBe(17);
    expect(merged.sprints).toHaveLength(1);
    expect(merged.sprints[0]?.durationS).toBeCloseTo(4, 5);
    expect(merged.sprintCount).toBe(1);

    const split = computeSessionMetrics(
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

    const result = computeSessionMetrics(
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
    const futsal = computeSessionMetrics(
      baseInput({ corners: cornersForAxis(40), playStructure: 'halves' }),
    );
    const training = computeSessionMetrics(
      baseInput({
        corners: cornersForAxis(40),
        playStructure: 'training_activities',
        pitchId: 'pitch-1',
      }),
    );
    const degenerate = computeSessionMetrics(
      baseInput({ corners: cornersForAxis(5), playStructure: 'halves' }),
    );
    const noPitch = computeSessionMetrics(
      baseInput({ corners: cornersForAxis(40), pitchId: null }),
    );

    expect(futsal.speedBandBucket).toBe('futsal');
    expect(futsal.speedBandBoundaries.sprint_min_kmh).toBe(15);
    expect(training.speedBandBucket).toBe('full');
    expect(degenerate.speedBandBucket).toBe('full');
    expect(noPitch.speedBandBucket).toBe('full');
    expect(futsal.pitchLongAxisM).toBeCloseTo(40, 0);
  });

  it('marks a short session insufficient and suppresses speed when none was recorded', () => {
    const insufficient = computeSessionMetrics(
      baseInput({
        segments: [segment({ id: 's1', index: 1, start: 0, end: 40 })],
        points: trail({ segmentId: 's1', startT: 0, speeds: Array.from({ length: 30 }, () => 8) }),
      }),
    );
    expect(insufficient.dataQuality).toBe('insufficient');

    const noSpeed = computeSessionMetrics(
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
    const result = computeSessionMetrics(
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
    const result = computeSessionMetrics(
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
    expect(result.algorithmVersion).toBe('v1');
  });
});

const cornersForAxis = (metres: number) => ({
  end_a_corner_1: { lat: latFor(0), lng: 3.4 },
  end_a_corner_2: { lat: latFor(0), lng: 3.4001 },
  end_b_corner_1: { lat: latFor(metres), lng: 3.4 },
  end_b_corner_2: { lat: latFor(metres), lng: 3.4001 },
});
