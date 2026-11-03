import { describe, expect, it } from 'vitest';
import type { ComputationInput, ComputationPause, ComputationPoint } from '../summary/types';
import { scaleAtLatitude } from './geodesic';
import { computeLiveReadout, readoutFromBasis } from './live-metrics';
import { createLiveTracker, feedLiveTracker, liveTrackerBasis } from './live-tracker';

const scale = scaleAtLatitude(6.6);
const origin = Date.parse('2026-11-03T12:48:00.000Z');
const at = (seconds: number) => new Date(origin + seconds * 1000).toISOString();

/** Deterministic noise in [-1, 1]. */
const noise = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return (state / 2147483648) * 2 - 1;
  };
};

type Leg = {
  seconds: number;
  speedMps: number;
  /** Heading in radians, north = 0. */
  heading: number;
  dopplerMissing?: boolean;
  /** No fix stored during the leg (the player still moves and steps). */
  silent?: boolean;
  accuracyM?: number;
  provider?: 'gps' | 'fused';
};

/** One segment's worth of fixes, walking the legs in order at one fix per second. */
const trace = ({
  segmentId,
  startSec,
  legs,
  seed,
}: {
  segmentId: string;
  startSec: number;
  legs: Leg[];
  seed: number;
}): { points: ComputationPoint[]; endSec: number; steps: number } => {
  const rand = noise(seed);
  const points: ComputationPoint[] = [];
  let t = startSec;
  let north = 0;
  let east = 0;
  let steps = 4000;
  for (const leg of legs) {
    for (let i = 0; i < leg.seconds; i += 1) {
      t += 1;
      north += Math.cos(leg.heading) * leg.speedMps;
      east += Math.sin(leg.heading) * leg.speedMps;
      steps += leg.speedMps > 0.3 ? Math.round(leg.speedMps * 1.6) : 0;
      if (leg.silent) continue;
      const accuracy = leg.accuracyM ?? 4 + Math.abs(rand()) * 4;
      points.push({
        segmentId,
        recordedAt: at(t),
        lat: 6.6 + (north + rand() * 3) / scale.mPerDegLat,
        lng: 3.35 + (east + rand() * 3) / scale.mPerDegLng,
        speedKmh: leg.dopplerMissing ? null : Math.max(0, leg.speedMps + rand() * 0.2) * 3.6,
        speedAccuracyMps: leg.dopplerMissing ? null : 0.4,
        horizontalAccuracyM: accuracy,
        provider: leg.provider ?? 'gps',
        stepCount: steps,
        accelVariance: leg.speedMps > 0.3 ? 2 + rand() : 0.02,
      });
    }
  }
  return { points, endSec: t, steps: steps - 4000 };
};

/** Feed every fix one at a time; at each checkpoint the tracker must read what the full pass reads. */
const expectParity = ({
  segments,
  pauses = [],
  points,
  every = 7,
}: {
  segments: { id: string; segmentIndex: number; startSec: number; endSec: number; steps: number }[];
  pauses?: ComputationPause[];
  points: ComputationPoint[];
  every?: number;
}) => {
  const tracker = createLiveTracker({ sessionId: 'x', corners: null, stride: null });
  let checked = 0;
  points.forEach((point, index) => {
    const nowSec = (Date.parse(point.recordedAt) - origin) / 1000 + 1;
    const input: ComputationInput = {
      playStructure: 'halves',
      pitchId: null,
      corners: null,
      segments: segments
        .filter((segment) => segment.startSec < nowSec)
        .map((segment) => ({
          id: segment.id,
          segmentIndex: segment.segmentIndex,
          startedAt: at(segment.startSec),
          endedAt: at(Math.min(segment.endSec, nowSec)),
          stepCount: segment.steps,
        })),
      pauses: pauses.filter((pause) => Date.parse(pause.startedAt) < origin + nowSec * 1000),
      points: points.slice(0, index + 1),
      massKg: null,
      computedAt: at(nowSec),
    };
    const segmentIds = new Set(input.segments.map((segment) => segment.id));
    expect(
      feedLiveTracker({ tracker, point, sequenceIndex: index, segmentIds, pauses: input.pauses }),
    ).toBe(true);
    if (index % every !== 0 && index !== points.length - 1) return;

    const latestFix = { accuracyM: point.horizontalAccuracyM, atMs: Date.parse(point.recordedAt) };
    const segmentId = point.segmentId;
    const full = computeLiveReadout({ input, segmentId, latestFix });
    const incremental = readoutFromBasis({
      basis: liveTrackerBasis({ tracker, input, segmentId }),
      nowMs: Date.parse(input.computedAt!),
      latestFix,
    });
    expect(incremental.distanceKm).toBeCloseTo(full.distanceKm ?? 0, 9);
    expect(incremental.topSpeedKmh).toBeCloseTo(full.topSpeedKmh ?? 0, 9);
    expect(incremental.signal).toBe(full.signal);
    checked += 1;
  });
  expect(checked).toBeGreaterThan(5);
  return tracker;
};

describe('live tracker parity with the full forward pass', () => {
  it('matches on a steady run with turns', () => {
    const run = trace({
      segmentId: 's1',
      startSec: 0,
      seed: 7,
      legs: [
        { seconds: 200, speedMps: 2.8, heading: 0 },
        { seconds: 120, speedMps: 3.4, heading: Math.PI / 2 },
        { seconds: 160, speedMps: 2.2, heading: Math.PI },
      ],
    });
    expectParity({
      segments: [{ id: 's1', segmentIndex: 1, startSec: 0, endSec: 9999, steps: run.steps }],
      points: run.points,
    });
  });

  it('matches through standing (ZUPT), a short gap, a reset gap, fused fixes and weak accuracy', () => {
    const walk = trace({
      segmentId: 's1',
      startSec: 0,
      seed: 11,
      legs: [
        { seconds: 90, speedMps: 1.4, heading: 0.3 },
        { seconds: 40, speedMps: 0, heading: 0 },
        { seconds: 60, speedMps: 1.5, heading: 1.2 },
        { seconds: 12, speedMps: 1.5, heading: 1.2, silent: true },
        { seconds: 50, speedMps: 1.3, heading: 2 },
        { seconds: 45, speedMps: 1.4, heading: 2, silent: true },
        { seconds: 40, speedMps: 1.4, heading: 2.5, provider: 'fused', accuracyM: 12 },
        { seconds: 40, speedMps: 1.6, heading: 3, accuracyM: 30 },
        { seconds: 30, speedMps: 1.6, heading: 3 },
      ],
    });
    expectParity({
      segments: [{ id: 's1', segmentIndex: 1, startSec: 0, endSec: 9999, steps: walk.steps + 40 }],
      points: walk.points,
    });
  });

  it('matches without Doppler (position-delta speed)', () => {
    const walk = trace({
      segmentId: 's1',
      startSec: 0,
      seed: 3,
      legs: [{ seconds: 200, speedMps: 1.5, heading: 0.8, dopplerMissing: true }],
    });
    expectParity({
      segments: [{ id: 's1', segmentIndex: 1, startSec: 0, endSec: 9999, steps: walk.steps }],
      points: walk.points,
    });
  });

  it('matches across a manual pause and two halves', () => {
    const first = trace({
      segmentId: 'h1',
      startSec: 0,
      seed: 5,
      legs: [
        { seconds: 80, speedMps: 2.5, heading: 0 },
        { seconds: 25, speedMps: 2.5, heading: 0, silent: true },
        { seconds: 80, speedMps: 3, heading: 1 },
      ],
    });
    const second = trace({
      segmentId: 'h2',
      startSec: first.endSec + 60,
      seed: 9,
      legs: [{ seconds: 150, speedMps: 3.2, heading: 2 }],
    });
    const pauses: ComputationPause[] = [
      { segmentId: 'h1', reason: 'manual', startedAt: at(81), endedAt: at(105) },
    ];
    expectParity({
      segments: [
        { id: 'h1', segmentIndex: 1, startSec: 0, endSec: first.endSec, steps: first.steps },
        {
          id: 'h2',
          segmentIndex: 2,
          startSec: first.endSec + 60,
          endSec: 9999,
          steps: second.steps,
        },
      ],
      pauses,
      points: [...first.points, ...second.points],
    });
  });

  it('asks for a rebuild when a fix arrives out of time order', () => {
    const run = trace({
      segmentId: 's1',
      startSec: 0,
      seed: 1,
      legs: [{ seconds: 10, speedMps: 2, heading: 0 }],
    });
    const tracker = createLiveTracker({ sessionId: 'x', corners: null, stride: null });
    const segmentIds = new Set(['s1']);
    const feed = (index: number) =>
      feedLiveTracker({
        tracker,
        point: run.points[index]!,
        sequenceIndex: index,
        segmentIds,
        pauses: [],
      });
    expect(feed(0)).toBe(true);
    expect(feed(2)).toBe(true);
    expect(feed(1)).toBe(false);
  });
});
