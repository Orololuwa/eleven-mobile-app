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

  it('suppresses distance and top speed whenever the summary would say insufficient', () => {
    const session = input({ endSec: 180, points: steady({ count: 181, horizontalAccuracyM: 30 }) });
    expect(computeSessionMetrics(session).dataQuality).toBe('insufficient');
    expect(computeLiveReadout({ input: session, segmentId: 's1' })).toEqual({
      distanceKm: null,
      topSpeedKmh: null,
      signal: 'poor',
    });
  });

  it('reads a young session with clean signal as settling, still suppressed', () => {
    const readout = computeLiveReadout({
      input: input({ endSec: 60, points: steady({ count: 61 }) }),
      segmentId: 's1',
    });
    expect(readout).toEqual({ distanceKm: null, topSpeedKmh: null, signal: 'settling' });
  });
});
