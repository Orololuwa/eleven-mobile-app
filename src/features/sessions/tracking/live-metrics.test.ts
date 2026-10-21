import { describe, expect, it } from 'vitest';
import { computeSessionMetrics } from '../summary/compute-session-metrics';
import type { ComputationInput, ComputationPoint } from '../summary/types';
import { passesLiveQualityGate } from './fix-gates';
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
    const endMs = Date.parse(session.computedAt!);
    const readout = computeLiveReadout({
      input: session,
      segmentId: 's1',
      latestFix: { accuracyM: 4, atMs: endMs - 500 },
    });
    expect(computeSessionMetrics(session).dataQuality).toBe('good');
    expect(readout.signal).toBe('good');
    expect(readout.distanceKm).toBeCloseTo(0.36, 2);
    expect(readout.topSpeedKmh).toBeCloseTo(7.2, 1);
  });

  it('does not show SIGNAL WEAK while a fresh summary-quality fix is arriving', () => {
    // Early gaps → session-level estimated, but the live feed is clean ±4 m.
    const points = [
      ...steady({ count: 30, horizontalAccuracyM: 80 }),
      ...steady({ count: 151 }).map((point, index) => ({
        ...point,
        recordedAt: at(30 + index),
        lat: 6.45 + ((30 + index) * 2) / scale.mPerDegLat,
      })),
    ];
    const session = input({ endSec: 180, points });
    const endMs = Date.parse(session.computedAt!);
    expect(
      computeSessionMetrics(session, { passesQuality: passesLiveQualityGate }).dataQuality,
    ).toBe('estimated');
    const readout = computeLiveReadout({
      input: session,
      segmentId: 's1',
      latestFix: { accuracyM: 4, atMs: endMs - 500 },
    });
    expect(readout.signal).toBe('good');
  });

  it('counts continuity-grade fixes on the live HUD even when summary quality fails', () => {
    const session = input({ endSec: 180, points: steady({ count: 181, horizontalAccuracyM: 30 }) });
    expect(computeSessionMetrics(session).dataQuality).toBe('insufficient');
    const readout = computeLiveReadout({ input: session, segmentId: 's1' });
    expect(readout.distanceKm).toBeCloseTo(0.36, 2);
    expect(readout.signal).not.toBe('poor');
  });

  it('still ignores fixes beyond the live/continuity gate', () => {
    const session = input({ endSec: 180, points: steady({ count: 181, horizontalAccuracyM: 80 }) });
    expect(computeLiveReadout({ input: session, segmentId: 's1' })).toEqual({
      distanceKm: 0,
      topSpeedKmh: 0,
      signal: 'poor',
    });
  });

  it('shows distance from the start and leaves settling once measuring past cold start', () => {
    const session = input({ endSec: 60, points: steady({ count: 61 }) });
    const endMs = Date.parse(session.computedAt!);
    const readout = computeLiveReadout({
      input: session,
      segmentId: 's1',
      latestFix: { accuracyM: 4, atMs: endMs - 500 },
    });
    // Summary is still insufficient (< 2 min / 120 fixes) but the live feed is clean.
    expect(computeSessionMetrics(session).dataQuality).toBe('insufficient');
    expect(readout.signal).toBe('good');
    expect(readout.distanceKm).toBeCloseTo(0.12, 2);
    expect(readout.topSpeedKmh).toBeCloseTo(7.2, 1);
  });

  it('keeps settling only while locking on (cold start, few live-quality fixes)', () => {
    const warming = steady({ count: 1, horizontalAccuracyM: 20 });
    const readout = computeLiveReadout({
      input: input({ endSec: 20, points: warming }),
      latestFix: null,
    });
    expect(readout.signal).toBe('settling');
  });

  it('reads continuity-grade measuring after settle as estimated, not early-settling', () => {
    const warming = steady({ count: 91, horizontalAccuracyM: 20 });
    const session = input({ endSec: 90, points: warming });
    const endMs = Date.parse(session.computedAt!);
    const readout = computeLiveReadout({
      input: session,
      latestFix: { accuracyM: 20, atMs: endMs - 500 },
    });
    expect(readout.signal).toBe('estimated');
    expect(readout.distanceKm).toBeCloseTo(0.18, 2);
  });

  it('does not show poor when a fresh live-quality OS fix is arriving', () => {
    const points = steady({ count: 91, horizontalAccuracyM: 80 });
    const session = input({ endSec: 90, points });
    const endMs = Date.parse(session.computedAt!);
    const readout = computeLiveReadout({
      input: session,
      latestFix: { accuracyM: 3.5, atMs: endMs - 500 },
    });
    expect(readout.signal).not.toBe('poor');
  });

  it('reads a start that never locks on as poor once the settle window passes', () => {
    const indoors = steady({ count: 91, horizontalAccuracyM: 80 });
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

  it('reads a stale OS fix feed as offline, not poor', () => {
    const session = input({ endSec: 180, points: steady({ count: 181, horizontalAccuracyM: 30 }) });
    const endMs = Date.parse(session.computedAt!);
    const readout = computeLiveReadout({
      input: session,
      segmentId: 's1',
      latestFix: { accuracyM: 8, atMs: endMs - 20_000 },
    });
    expect(readout.signal).toBe('offline');
    expect(readout.distanceKm).toBeCloseTo(0.36, 2);
  });

  it('reads a fresh weak fix beyond the live gate as poor when not measuring', () => {
    const session = input({ endSec: 90, points: steady({ count: 91, horizontalAccuracyM: 80 }) });
    const endMs = Date.parse(session.computedAt!);
    const readout = computeLiveReadout({
      input: session,
      latestFix: { accuracyM: 80, atMs: endMs - 1_000 },
    });
    expect(readout.signal).toBe('poor');
  });

  it('reads offline even when earlier metrics would have been good', () => {
    const session = input({ endSec: 180, points: steady({ count: 181 }) });
    const endMs = Date.parse(session.computedAt!);
    expect(computeSessionMetrics(session).dataQuality).toBe('good');
    const readout = computeLiveReadout({
      input: session,
      segmentId: 's1',
      latestFix: { accuracyM: 3, atMs: endMs - 20_000 },
    });
    expect(readout.signal).toBe('offline');
    expect(readout.distanceKm).toBeCloseTo(0.36, 2);
  });

  it('keeps settling on a cold start before any OS fix arrives', () => {
    const warming = steady({ count: 31, horizontalAccuracyM: 20 });
    const session = input({ endSec: 30, points: warming });
    const readout = computeLiveReadout({ input: session, latestFix: null });
    expect(readout.signal).toBe('settling');
  });
});
