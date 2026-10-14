import { describe, expect, it } from 'vitest';
import { computeSessionMetrics } from '../summary/compute-session-metrics';
import type { ComputationInput, ComputationPoint } from '../summary/types';
import { computeLiveReadout } from './live-metrics';
import { scaleAtLatitude } from './geodesic';

const scale = scaleAtLatitude(6.45);
const origin = Date.parse('2026-10-13T10:00:00.000Z');
const at = (seconds: number) => new Date(origin + seconds * 1000).toISOString();

const steady = ({
  count,
  horizontalAccuracyM = 5,
}: {
  count: number;
  horizontalAccuracyM?: number;
}): ComputationPoint[] =>
  Array.from({ length: count }, (_, index) => ({
    segmentId: 's1',
    recordedAt: at(index),
    lat: 6.45 + (index * 2) / scale.mPerDegLat,
    lng: 3.4,
    speedKmh: 7.2,
    speedAccuracyMps: 1,
    horizontalAccuracyM,
  }));

const input = ({
  endSec,
  points,
}: {
  endSec: number;
  points: ComputationPoint[];
}): ComputationInput => ({
  playStructure: 'halves',
  pitchId: null,
  corners: null,
  segments: [{ id: 's1', segmentIndex: 1, startedAt: at(0), endedAt: at(endSec) }],
  pauses: [],
  points,
  massKg: null,
  computedAt: at(endSec),
});

describe('computeLiveReadout', () => {
  it('shows distance and top speed when the summary would classify the session good', () => {
    const session = input({ endSec: 180, points: steady({ count: 181 }) });
    const readout = computeLiveReadout({ input: session, segmentId: 's1' });
    expect(computeSessionMetrics(session).dataQuality).toBe('good');
    expect(readout.signal).toBe('good');
    expect(readout.distanceKm).toBeCloseTo(0.36, 2);
    expect(readout.topSpeedKmh).toBeCloseTo(7.2, 1);
  });

  it('counts nothing from fixes that fail the quality gate', () => {
    const session = input({ endSec: 180, points: steady({ count: 181, horizontalAccuracyM: 30 }) });
    expect(computeSessionMetrics(session).dataQuality).toBe('insufficient');
    expect(computeLiveReadout({ input: session, segmentId: 's1' })).toEqual({
      distanceKm: 0,
      topSpeedKmh: 0,
      signal: 'poor',
    });
  });

  it('shows distance and top speed from the start, reading a young session as settling', () => {
    const readout = computeLiveReadout({
      input: input({ endSec: 60, points: steady({ count: 61 }) }),
      segmentId: 's1',
    });
    expect(readout.signal).toBe('settling');
    expect(readout.distanceKm).toBeCloseTo(0.12, 2);
    expect(readout.topSpeedKmh).toBeCloseTo(7.2, 1);
  });

  it('reads a cold GPS start as settling until the first quality fix', () => {
    const warming = steady({ count: 31, horizontalAccuracyM: 20 });
    const readout = computeLiveReadout({ input: input({ endSec: 30, points: warming }) });
    expect(readout.signal).toBe('settling');
  });

  it('keeps reading settling when only the first quality fix has arrived', () => {
    const points = [
      ...steady({ count: 30, horizontalAccuracyM: 20 }),
      { ...steady({ count: 31 })[30]! },
    ];
    const readout = computeLiveReadout({ input: input({ endSec: 30, points }) });
    expect(readout.signal).toBe('settling');
  });

  it('reads a start that never locks on as poor once the settle window passes', () => {
    const indoors = steady({ count: 91, horizontalAccuracyM: 20 });
    const readout = computeLiveReadout({ input: input({ endSec: 90, points: indoors }) });
    expect(readout.signal).toBe('poor');
  });

  it('reads accurate fixes arriving wider apart than the bridge window as poor', () => {
    const sparse = steady({ count: 61 }).filter((_, index) => index % 8 === 0);
    const readout = computeLiveReadout({ input: input({ endSec: 56, points: sparse }) });
    expect(readout.signal).toBe('poor');
  });

  it('reads clean signal after earlier gaps as recovering, not poor', () => {
    const points = steady({ count: 181 }).filter((_, index) => index >= 100);
    const readout = computeLiveReadout({ input: input({ endSec: 180, points }) });
    expect(readout.signal).toBe('recovering');
  });

  it('reads a session that lost signal just now as poor', () => {
    const points = steady({ count: 181 }).filter(
      (_, index) => index <= 60 || (index >= 110 && index <= 170),
    );
    const readout = computeLiveReadout({ input: input({ endSec: 180, points }) });
    expect(readout.signal).toBe('poor');
  });
});
