import type { SessionCalendar, SessionListItem, SessionType } from '../types';
import type {
  LocalHistoryRow,
  PendingDeletionRow,
  PendingRenameRow,
  SyncStatus,
} from '../tracking/types';
import { displaySessionTitle, type PresentableMetrics } from '../summary/session-presentation';

export type HistoryEntry = {
  id: string;
  sessionType: SessionType;
  startedAt: string;
  pitchName: string | null;
  title: string;
  /** Local sync state; null once the server row is the source. */
  syncStatus: Exclude<SyncStatus, 'synced'> | null;
  metrics: PresentableMetrics | null;
};

const fromServer = (
  item: SessionListItem,
): Omit<HistoryEntry, 'title'> & { storedTitle: string | null } => ({
  id: item.id,
  sessionType: item.session_type,
  startedAt: item.started_at,
  pitchName: item.pitch?.name ?? null,
  storedTitle: item.title,
  syncStatus: null,
  metrics: item.metrics,
});

const fromLocal = (
  row: LocalHistoryRow,
): Omit<HistoryEntry, 'title'> & { storedTitle: string | null } => ({
  id: row.id,
  sessionType: row.session_type,
  startedAt: row.started_at,
  pitchName: row.pitch_name,
  storedTitle: row.title,
  syncStatus: row.sync_status === 'synced' ? null : row.sync_status,
  metrics:
    row.metrics_session_id != null && row.distance_m != null && row.speed_source && row.data_quality
      ? {
          distance_m: row.distance_m,
          top_speed_kmh: row.top_speed_kmh,
          speed_source: row.speed_source,
          data_quality: row.data_quality,
        }
      : null,
});

const newestFirst = (
  a: { startedAt: string; id: string },
  b: { startedAt: string; id: string },
) => {
  const byTime = Date.parse(b.startedAt) - Date.parse(a.startedAt);
  if (byTime !== 0) return byTime;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
};

const toRenameMap = (renames: PendingRenameRow[]) =>
  new Map(renames.map((row) => [row.session_id, row.title]));

/**
 * One list from server pages and this device's unsynced sessions.
 * A local-only row is held back until pagination reaches its position, so it never jumps.
 */
export const mergeHistory = ({
  serverItems,
  serverExhausted,
  localRows,
  deletions,
  renames,
}: {
  serverItems: SessionListItem[];
  /** No further pages, or the server can't be reached and nothing is cached. */
  serverExhausted: boolean;
  localRows: LocalHistoryRow[];
  deletions: PendingDeletionRow[];
  renames: PendingRenameRow[];
}): HistoryEntry[] => {
  const deleted = new Set(deletions.map((row) => row.session_id));
  const renameMap = toRenameMap(renames);
  const local = localRows.map(fromLocal);
  const localIds = new Set(local.map((row) => row.id));
  const server = serverItems.map(fromServer);
  const serverIds = new Set(server.map((row) => row.id));
  const oldestServer = server.reduce<number | null>((oldest, row) => {
    const time = Date.parse(row.startedAt);
    return oldest == null || time < oldest ? time : oldest;
  }, null);
  const isInWindow = (startedAt: string) =>
    serverExhausted || (oldestServer != null && Date.parse(startedAt) >= oldestServer);

  return [
    ...server.filter((row) => !localIds.has(row.id)),
    ...local.filter((row) => serverIds.has(row.id) || isInWindow(row.startedAt)),
  ]
    .filter((row) => !deleted.has(row.id))
    .sort(newestFirst)
    .map(({ storedTitle, ...row }) => ({
      ...row,
      title: displaySessionTitle({
        startedAt: row.startedAt,
        sessionType: row.sessionType,
        title: storedTitle,
        pendingTitle: renameMap.has(row.id) ? (renameMap.get(row.id) ?? null) : undefined,
      }),
    }));
};

const matchesType = (sessionType: SessionType | null) => (rowType: SessionType | null) =>
  sessionType == null || rowType === sessionType;

/** Server total + sessions the server can't be counting yet − deletions it still counts. */
export const countHistory = ({
  totalCount,
  localRows,
  deletions,
  sessionType = null,
}: {
  totalCount: number | null;
  localRows: LocalHistoryRow[];
  deletions: PendingDeletionRow[];
  sessionType?: SessionType | null;
}) => {
  const matches = matchesType(sessionType);
  const unacknowledged = localRows.filter(
    (row) => row.finalized_at == null && matches(row.session_type),
  ).length;
  const stillCounted = deletions.filter(
    (row) => row.counted_by_server === 1 && matches(row.session_type),
  ).length;
  return Math.max(0, (totalCount ?? 0) + unacknowledged - stillCounted);
};

export const formatSessionCount = (count: number) =>
  `${count} ${count === 1 ? 'SESSION' : 'SESSIONS'}`;

const localDayKey = (iso: string) => {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** Day of month → session ids played that day, merged by id and without pending deletions. */
export const buildCalendarDays = ({
  calendar,
  localRows,
  deletions,
  month,
}: {
  calendar: SessionCalendar | undefined;
  localRows: LocalHistoryRow[];
  deletions: PendingDeletionRow[];
  month: string;
}) => {
  const deleted = new Set(deletions.map((row) => row.session_id));
  const entries = [
    ...(calendar?.days ?? []).flatMap((day) =>
      day.session_ids.map((id) => ({ date: day.date, id })),
    ),
    ...localRows.map((row) => ({ date: localDayKey(row.started_at), id: row.id })),
  ].filter(({ date, id }) => date.startsWith(`${month}-`) && !deleted.has(id));

  return entries.reduce<Map<number, string[]>>((days, { date, id }) => {
    const day = Number(date.slice(8, 10));
    const ids = days.get(day) ?? [];
    return ids.includes(id) ? days : new Map(days).set(day, [...ids, id]);
  }, new Map());
};

export const isSameLocalDay = ({ iso, day, month }: { iso: string; day: number; month: string }) =>
  localDayKey(iso) === `${month}-${String(day).padStart(2, '0')}`;
