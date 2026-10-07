import { describe, expect, it } from 'vitest';
import type { WeeklySessionItem } from '../types';
import type { LocalWeeklyRow, PendingDeletionRow } from '../tracking/types';
import { buildWeeklyStats, weekBounds } from './weekly-stats';

const local = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min);
const iso = (date: Date) => date.toISOString();

// Wednesday 7 Oct 2026, 18:00 local: current week from Mon 5 Oct, baseline Mon 28 Sep – Wed 30 Sep 18:00.
const NOW = local(2026, 10, 7, 18);

const serverItem = ({
  id,
  startedAt,
  distanceM = 8000,
  activeSeconds = 3600,
  dataQuality = 'good',
  withMetrics = true,
}: {
  id: string;
  startedAt: Date;
  distanceM?: number;
  activeSeconds?: number;
  dataQuality?: 'good' | 'estimated' | 'insufficient';
  withMetrics?: boolean;
}): WeeklySessionItem => ({
  id,
  started_at: iso(startedAt),
  metrics: withMetrics
    ? { distance_m: distanceM, active_duration_seconds: activeSeconds, data_quality: dataQuality }
    : null,
});

const localRow = ({
  id,
  startedAt,
  distanceM = 8000,
  activeSeconds = 3600,
}: {
  id: string;
  startedAt: Date;
  distanceM?: number;
  activeSeconds?: number;
}): LocalWeeklyRow => ({
  id,
  started_at: iso(startedAt),
  metrics_session_id: id,
  distance_m: distanceM,
  active_duration_seconds: activeSeconds,
  data_quality: 'good',
});

const deletion = (id: string): PendingDeletionRow => ({
  session_id: id,
  user_id: 'u',
  counted_by_server: 1,
  requested_at: iso(NOW),
  attempts: 0,
  last_attempt_at: null,
  session_type: 'match',
});

const build = ({
  serverItems = [] as WeeklySessionItem[],
  localRows = [] as LocalWeeklyRow[],
  deletions = [] as PendingDeletionRow[],
  now = NOW,
} = {}) => buildWeeklyStats({ serverItems, localRows, deletions, now });

describe('weekBounds', () => {
  it('starts the week on the most recent Monday 00:00 local', () => {
    expect(weekBounds({ now: NOW }).weekStart).toEqual(local(2026, 10, 5, 0));
    expect(weekBounds({ now: local(2026, 10, 11, 23, 59) }).weekStart).toEqual(
      local(2026, 10, 5, 0),
    );
  });

  it('uses the same day on a Monday', () => {
    expect(weekBounds({ now: local(2026, 10, 5, 0, 1) }).weekStart).toEqual(local(2026, 10, 5, 0));
  });

  it('ends the baseline at the same weekday and time a week earlier', () => {
    const bounds = weekBounds({ now: NOW });
    expect(bounds.baselineStart).toEqual(local(2026, 9, 28, 0));
    expect(bounds.baselineEnd).toEqual(local(2026, 9, 30, 18));
    expect(bounds.nextWeekStart).toEqual(local(2026, 10, 12, 0));
  });
});

describe('buildWeeklyStats', () => {
  it('counts a session present in both sources once', () => {
    const startedAt = local(2026, 10, 6);
    const stats = build({
      serverItems: [serverItem({ id: 'a', startedAt })],
      localRows: [localRow({ id: 'a', startedAt })],
    });
    expect(stats.current.sessions).toBe(1);
    expect(stats.current.distanceM).toBe(8000);
  });

  it('excludes a pending deletion still in the server rows', () => {
    const stats = build({
      serverItems: [serverItem({ id: 'a', startedAt: local(2026, 10, 6) })],
      deletions: [deletion('a')],
    });
    expect(stats.current.sessions).toBe(0);
  });

  it('excludes insufficient and no-metrics sessions from every figure', () => {
    const stats = build({
      serverItems: [
        serverItem({ id: 'a', startedAt: local(2026, 10, 6), dataQuality: 'insufficient' }),
        serverItem({ id: 'b', startedAt: local(2026, 10, 6), withMetrics: false }),
      ],
    });
    expect(stats.current).toEqual({
      sessions: 0,
      distanceM: 0,
      activeSeconds: 0,
      avgSpeedKmh: null,
    });
  });

  it('includes estimated sessions', () => {
    const stats = build({
      serverItems: [
        serverItem({ id: 'a', startedAt: local(2026, 10, 6), dataQuality: 'estimated' }),
      ],
    });
    expect(stats.current.sessions).toBe(1);
  });

  it('computes average speed as a ratio of sums', () => {
    const stats = build({
      serverItems: [
        serverItem({
          id: 'a',
          startedAt: local(2026, 10, 5),
          distanceM: 8000,
          activeSeconds: 80 * 60,
        }),
        serverItem({
          id: 'b',
          startedAt: local(2026, 10, 6),
          distanceM: 1000,
          activeSeconds: 20 * 60,
        }),
      ],
    });
    expect(stats.current.avgSpeedKmh).toBeCloseTo(5.4);
  });

  it('places a Sunday 23:30 kickoff in the previous week and Monday 00:00 in the current one', () => {
    const now = local(2026, 10, 5, 12);
    const stats = build({
      now,
      serverItems: [
        serverItem({ id: 'sun', startedAt: local(2026, 10, 4, 23, 30) }),
        serverItem({ id: 'mon', startedAt: local(2026, 10, 5, 0, 0) }),
      ],
    });
    expect(stats.current.sessions).toBe(1);
  });

  it('leaves a session just after now − 7 days out of the baseline', () => {
    const stats = build({
      serverItems: [serverItem({ id: 'a', startedAt: local(2026, 9, 30, 18, 1) })],
    });
    expect(stats.baseline.sessions).toBe(0);
  });

  it('shows no arrows when both windows are empty', () => {
    expect(build().arrows).toEqual({ sessions: null, distance: null, time: null, avgSpeed: null });
  });

  it('shows up from a zero baseline, but no speed arrow without a baseline speed', () => {
    const stats = build({ serverItems: [serverItem({ id: 'a', startedAt: local(2026, 10, 6) })] });
    expect(stats.arrows).toEqual({ sessions: 'up', distance: 'up', time: 'up', avgSpeed: null });
  });

  it('shows down when behind last week at this point', () => {
    const stats = build({ serverItems: [serverItem({ id: 'a', startedAt: local(2026, 9, 29) })] });
    expect(stats.arrows).toEqual({
      sessions: 'down',
      distance: 'down',
      time: 'down',
      avgSpeed: null,
    });
  });

  it('compares at display precision (6.81 vs 6.79 km/h is level)', () => {
    const stats = build({
      serverItems: [
        serverItem({
          id: 'a',
          startedAt: local(2026, 9, 29),
          distanceM: 6790,
          activeSeconds: 3600,
        }),
        serverItem({
          id: 'b',
          startedAt: local(2026, 10, 6),
          distanceM: 6810,
          activeSeconds: 3600,
        }),
      ],
    });
    expect(stats.arrows.avgSpeed).toBe('level');
    expect(stats.arrows.sessions).toBe('level');
  });
});
