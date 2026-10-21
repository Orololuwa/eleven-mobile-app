import { describe, expect, it } from 'vitest';
import { elapsedSecondsFromPauses } from './live-metrics';
import {
  elapsedSecondsAt,
  hudPatchFromSnapshot,
  isLiveSnapshotStale,
  liveClockFromRows,
  newestFix,
  type LiveSnapshot,
} from './live-snapshot-model';

const T0 = Date.parse('2026-10-20T12:00:00.000Z');
const iso = (offsetS: number) => new Date(T0 + offsetS * 1000).toISOString();

const snapshotWith = (patch: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  sessionId: 's1',
  segmentId: 'seg1',
  segmentIndex: 1,
  segmentLabel: 'RUN 1',
  activityKind: 'run',
  attackDirection: null,
  trackingStatus: 'live',
  clock: liveClockFromRows({ startedAt: iso(0), pauses: [] }),
  sessionClock: liveClockFromRows({ startedAt: iso(0), pauses: [] }),
  plannedSeconds: null,
  metrics: { distanceKm: 1.2, topSpeedKmh: 14, signal: 'good' },
  latestFix: { atMs: T0 + 60_000, accuracyM: 4 },
  gpsSearchStartedAtMs: null,
  computedAtMs: T0 + 60_000,
  ...patch,
});

describe('liveClockFromRows / elapsedSecondsAt', () => {
  it('matches elapsedSecondsFromPauses for closed and open pauses', () => {
    const pauses = [
      { started_at: iso(60), ended_at: iso(90) },
      { started_at: iso(300), ended_at: null },
    ];
    const clock = liveClockFromRows({ startedAt: iso(0), pauses });
    // Rows only ever describe the past, so `now` is at or after the last pause start.
    for (const at of [300, 301, 450, 900]) {
      const nowMs = T0 + at * 1000;
      expect(elapsedSecondsAt(clock, nowMs)).toBe(
        elapsedSecondsFromPauses({ startedAt: iso(0), pausedRanges: pauses, nowMs }),
      );
    }
  });

  it('holds at the open pause start', () => {
    const clock = liveClockFromRows({
      startedAt: iso(0),
      pauses: [{ started_at: iso(100), ended_at: null }],
    });
    expect(elapsedSecondsAt(clock, T0 + 100_000)).toBe(100);
    expect(elapsedSecondsAt(clock, T0 + 3_600_000)).toBe(100);
  });

  it('reads 0 with no running segment (training rest)', () => {
    const clock = liveClockFromRows({ startedAt: null, pauses: [] });
    expect(elapsedSecondsAt(clock, T0 + 3_600_000)).toBe(0);
  });

  it('keeps counting across a gap with no pause — a frozen app is not a paused player', () => {
    const clock = liveClockFromRows({ startedAt: iso(0), pauses: [] });
    expect(elapsedSecondsAt(clock, T0 + 25 * 60_000)).toBe(25 * 60);
  });
});

describe('newestFix', () => {
  it('prefers the newer fix whichever side it is on', () => {
    const older = { atMs: 1, accuracyM: 5 };
    const newer = { atMs: 2, accuracyM: 9 };
    expect(newestFix(older, newer)).toBe(newer);
    expect(newestFix(newer, older)).toBe(newer);
    expect(newestFix(null, older)).toBe(older);
    expect(newestFix(older, null)).toBe(older);
    expect(newestFix(null, null)).toBeNull();
  });
});

describe('isLiveSnapshotStale', () => {
  it('is stale only past the threshold', () => {
    expect(isLiveSnapshotStale({ computedAtMs: 0, nowMs: 2_500, staleMs: 2_500 })).toBe(false);
    expect(isLiveSnapshotStale({ computedAtMs: 0, nowMs: 2_501, staleMs: 2_500 })).toBe(true);
  });
});

describe('hudPatchFromSnapshot', () => {
  it('advances the clock from the anchors, not from computedAt', () => {
    const snapshot = snapshotWith();
    expect(hudPatchFromSnapshot({ snapshot, nowMs: T0 + 61_000 }).elapsedSeconds).toBe(61);
    expect(hudPatchFromSnapshot({ snapshot, nowMs: T0 + 600_000 }).elapsedSeconds).toBe(600);
  });

  it('splits overrun into extra seconds', () => {
    const snapshot = snapshotWith({ plannedSeconds: 60 });
    const patch = hudPatchFromSnapshot({ snapshot, nowMs: T0 + 75_000 });
    expect(patch.elapsedSeconds).toBe(75);
    expect(patch.extraSeconds).toBe(15);
  });

  it('uses the fresher in-memory fix for GPS accuracy and drops a stale one', () => {
    const snapshot = snapshotWith();
    const memoryFix = { atMs: T0 + 64_000, accuracyM: 3 };
    expect(hudPatchFromSnapshot({ snapshot, memoryFix, nowMs: T0 + 65_000 }).gpsAccuracyM).toBe(3);
    expect(hudPatchFromSnapshot({ snapshot, nowMs: T0 + 3_600_000 }).gpsAccuracyM).toBeNull();
  });

  it('counts GPS search seconds from the persisted start', () => {
    const snapshot = snapshotWith({ gpsSearchStartedAtMs: T0 + 50_000 });
    expect(hudPatchFromSnapshot({ snapshot, nowMs: T0 + 80_000 }).gpsSearchSeconds).toBe(30);
  });
});
