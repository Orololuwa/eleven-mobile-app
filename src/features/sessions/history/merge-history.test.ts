import { describe, expect, it } from 'vitest';
import type { SessionListItem } from '../types';
import type { LocalHistoryRow, PendingDeletionRow, PendingRenameRow } from '../tracking/types';
import { buildCalendarDays, countHistory, formatSessionCount, mergeHistory } from './merge-history';

const localIso = (y: number, m: number, d: number, h = 10) =>
  new Date(y, m - 1, d, h).toISOString();

const serverItem = ({
  id,
  startedAt,
  title = null,
}: {
  id: string;
  startedAt: string;
  title?: string | null;
}): SessionListItem => ({
  id,
  title,
  session_type: 'match',
  started_at: startedAt,
  ended_at: startedAt,
  pitch: { id: 'p', name: 'Lekki' },
  metrics: {
    active_duration_seconds: 3600,
    distance_m: 8000,
    top_speed_kmh: 30,
    speed_source: 'os',
    data_quality: 'good',
  },
});

const localRow = ({
  id,
  startedAt,
  syncStatus = 'pending',
  finalizedAt = null,
  sessionType = 'match',
}: {
  id: string;
  startedAt: string;
  syncStatus?: LocalHistoryRow['sync_status'];
  finalizedAt?: string | null;
  sessionType?: LocalHistoryRow['session_type'];
}): LocalHistoryRow => ({
  id,
  session_type: sessionType,
  started_at: startedAt,
  ended_at: startedAt,
  pitch_id: null,
  pitch_name: null,
  title: null,
  sync_status: syncStatus,
  finalized_at: finalizedAt,
  metrics_session_id: id,
  active_duration_seconds: 3600,
  distance_m: 5000,
  top_speed_kmh: 25,
  speed_source: 'os',
  data_quality: 'good',
});

const deletion = ({
  id,
  counted = true,
  sessionType = 'match',
}: {
  id: string;
  counted?: boolean;
  sessionType?: PendingDeletionRow['session_type'];
}): PendingDeletionRow => ({
  session_id: id,
  user_id: 'u',
  counted_by_server: counted ? 1 : 0,
  requested_at: '2026-10-01T00:00:00Z',
  attempts: 0,
  last_attempt_at: null,
  session_type: sessionType,
});

const rename = ({ id, title }: { id: string; title: string | null }): PendingRenameRow => ({
  session_id: id,
  user_id: 'u',
  title,
  requested_at: '2026-10-01T00:00:00Z',
  attempts: 0,
  last_attempt_at: null,
});

describe('mergeHistory', () => {
  const base = { deletions: [], renames: [] };

  it('prefers the local row when both sources have the id', () => {
    const startedAt = localIso(2026, 9, 26);
    const result = mergeHistory({
      ...base,
      serverItems: [serverItem({ id: 'a', startedAt })],
      serverExhausted: true,
      localRows: [localRow({ id: 'a', startedAt, syncStatus: 'syncing' })],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.syncStatus).toBe('syncing');
  });

  it('sorts newest first by started_at', () => {
    const result = mergeHistory({
      ...base,
      serverItems: [
        serverItem({ id: 'old', startedAt: localIso(2026, 9, 1) }),
        serverItem({ id: 'new', startedAt: localIso(2026, 9, 20) }),
      ],
      serverExhausted: true,
      localRows: [localRow({ id: 'mid', startedAt: localIso(2026, 9, 10) })],
    });
    expect(result.map((row) => row.id)).toEqual(['new', 'mid', 'old']);
  });

  it('holds back an old local-only row until pagination reaches it', () => {
    const args = {
      ...base,
      serverItems: [serverItem({ id: 's', startedAt: localIso(2026, 9, 20) })],
      localRows: [
        localRow({ id: 'rejected', startedAt: localIso(2026, 8, 1), syncStatus: 'rejected' }),
      ],
    };
    expect(mergeHistory({ ...args, serverExhausted: false }).map((row) => row.id)).toEqual(['s']);
    expect(mergeHistory({ ...args, serverExhausted: true }).map((row) => row.id)).toEqual([
      's',
      'rejected',
    ]);
  });

  it('drops pending deletions and applies pending renames', () => {
    const result = mergeHistory({
      serverItems: [
        serverItem({ id: 'gone', startedAt: localIso(2026, 9, 20) }),
        serverItem({ id: 'kept', startedAt: localIso(2026, 9, 19), title: 'Old name' }),
      ],
      serverExhausted: true,
      localRows: [],
      deletions: [deletion({ id: 'gone' })],
      renames: [rename({ id: 'kept', title: 'New name' })],
    });
    expect(result.map((row) => [row.id, row.title])).toEqual([['kept', 'New name']]);
  });

  it('marks a local session without metrics as no metrics', () => {
    const row = {
      ...localRow({ id: 'x', startedAt: localIso(2026, 9, 20) }),
      metrics_session_id: null,
    };
    const [entry] = mergeHistory({
      ...base,
      serverItems: [],
      serverExhausted: true,
      localRows: [row],
    });
    expect(entry?.metrics).toBeNull();
  });
});

describe('countHistory', () => {
  it('adds unacknowledged local sessions and removes deletions the server still counts', () => {
    expect(
      countHistory({
        totalCount: 10,
        localRows: [
          localRow({ id: 'a', startedAt: localIso(2026, 9, 1) }),
          localRow({
            id: 'b',
            startedAt: localIso(2026, 9, 2),
            finalizedAt: '2026-09-02T00:00:00Z',
          }),
        ],
        deletions: [deletion({ id: 'c' }), deletion({ id: 'd', counted: false })],
      }),
    ).toBe(10);
  });

  it('applies the type filter to local rows and deletions', () => {
    expect(
      countHistory({
        totalCount: 3,
        sessionType: 'futsal',
        localRows: [localRow({ id: 'a', startedAt: localIso(2026, 9, 1), sessionType: 'match' })],
        deletions: [deletion({ id: 'c', sessionType: 'match' })],
      }),
    ).toBe(3);
  });

  it('formats the singular', () => {
    expect(formatSessionCount(1)).toBe('1 SESSION');
    expect(formatSessionCount(23)).toBe('23 SESSIONS');
  });
});

describe('buildCalendarDays', () => {
  it('unions server and local ids by day and removes pending deletions', () => {
    const days = buildCalendarDays({
      month: '2026-09',
      calendar: {
        month: '2026-09',
        days: [
          { date: '2026-09-03', session_ids: ['a', 'b'] },
          { date: '2026-09-05', session_ids: ['gone'] },
        ],
      },
      localRows: [
        localRow({ id: 'a', startedAt: localIso(2026, 9, 3) }),
        localRow({ id: 'c', startedAt: localIso(2026, 9, 7) }),
        localRow({ id: 'last-month', startedAt: localIso(2026, 8, 30) }),
      ],
      deletions: [deletion({ id: 'gone' })],
    });
    expect([...days.entries()]).toEqual([
      [3, ['a', 'b']],
      [7, ['c']],
    ]);
  });
});
