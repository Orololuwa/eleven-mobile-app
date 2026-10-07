import type { DistanceUnit } from '@/types/profile';
import type { WeeklySessionItem } from '../types';
import type { LocalWeeklyRow, PendingDeletionRow } from '../tracking/types';
import type { DataQuality } from '../summary/types';
import { formatSummaryDistance, formatSummarySpeed } from '../summary/display';

export type WeekSession = {
  id: string;
  startedAt: string;
  metrics: { distanceM: number; activeSeconds: number; dataQuality: DataQuality } | null;
};

export type WeeklyFigures = {
  sessions: number;
  distanceM: number;
  activeSeconds: number;
  /** Null when no session in the window counts. */
  avgSpeedKmh: number | null;
};

export type WeeklyArrow = 'up' | 'down' | 'level' | null;

export type WeeklyArrows = {
  sessions: WeeklyArrow;
  distance: WeeklyArrow;
  time: WeeklyArrow;
  avgSpeed: WeeklyArrow;
};

export type WeeklyStats = {
  current: WeeklyFigures;
  baseline: WeeklyFigures;
  arrows: WeeklyArrows;
};

export type WeeklyDisplay = {
  sessions: number;
  distance: number;
  minutes: number;
  avgSpeed: number | null;
};

const shiftDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Week windows in the device's local calendar. The week starts Monday 00:00 for everyone.
 * `baselineEnd` is the same weekday and wall-clock time a week ago, so DST weeks stay 7 calendar days.
 */
export const weekBounds = ({ now = new Date() }: { now?: Date } = {}) => {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const weekStart = shiftDays(midnight, -((midnight.getDay() + 6) % 7));
  return {
    baselineStart: shiftDays(weekStart, -7),
    weekStart,
    nextWeekStart: shiftDays(weekStart, 7),
    baselineEnd: shiftDays(now, -7),
  };
};

/** Local `YYYY-MM-DD` of the week's Monday; scopes the weekly query key. */
export const weekStartKey = (weekStart: Date) =>
  [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, '0'),
    String(weekStart.getDate()).padStart(2, '0'),
  ].join('-');

/** The one rule for whether a session adds to weekly figures: has metrics and isn't `insufficient`. */
export const countsTowardWeek = ({ metrics }: WeekSession) =>
  metrics != null && metrics.dataQuality !== 'insufficient';

const fromServer = ({ id, started_at, metrics }: WeeklySessionItem): WeekSession => ({
  id,
  startedAt: started_at,
  metrics: metrics && {
    distanceM: metrics.distance_m,
    activeSeconds: metrics.active_duration_seconds,
    dataQuality: metrics.data_quality,
  },
});

const fromLocal = (row: LocalWeeklyRow): WeekSession => ({
  id: row.id,
  startedAt: row.started_at,
  metrics:
    row.metrics_session_id != null &&
    row.distance_m != null &&
    row.active_duration_seconds != null &&
    row.data_quality != null
      ? {
          distanceM: row.distance_m,
          activeSeconds: row.active_duration_seconds,
          dataQuality: row.data_quality,
        }
      : null,
});

/** Union by id (local row wins), without pending deletions, keeping only sessions that count. */
export const mergeWeekSessions = ({
  serverItems,
  localRows,
  deletions,
}: {
  serverItems: WeeklySessionItem[];
  localRows: LocalWeeklyRow[];
  deletions: PendingDeletionRow[];
}) => {
  const deleted = new Set(deletions.map((row) => row.session_id));
  const local = localRows.map(fromLocal);
  const localIds = new Set(local.map((row) => row.id));
  return [...serverItems.map(fromServer).filter((row) => !localIds.has(row.id)), ...local]
    .filter((row) => !deleted.has(row.id))
    .filter(countsTowardWeek);
};

const sumFigures = (sessions: WeekSession[]): WeeklyFigures => {
  const distanceM = sessions.reduce((sum, { metrics }) => sum + (metrics?.distanceM ?? 0), 0);
  const activeSeconds = sessions.reduce(
    (sum, { metrics }) => sum + (metrics?.activeSeconds ?? 0),
    0,
  );
  return {
    sessions: sessions.length,
    distanceM,
    activeSeconds,
    avgSpeedKmh: activeSeconds > 0 ? distanceM / 1000 / (activeSeconds / 3600) : null,
  };
};

/** Figures rounded exactly as the tiles show them. Arrows compare these, never raw values. */
export const displayWeeklyFigures = ({
  figures,
  distanceUnit = 'km',
}: {
  figures: WeeklyFigures;
  distanceUnit?: DistanceUnit;
}): WeeklyDisplay => ({
  sessions: figures.sessions,
  distance: Number(formatSummaryDistance({ metres: figures.distanceM, unit: distanceUnit })),
  minutes: Math.round(figures.activeSeconds / 60),
  avgSpeed:
    figures.avgSpeedKmh == null
      ? null
      : Number(formatSummarySpeed({ kmh: figures.avgSpeedKmh, unit: distanceUnit })),
});

const compare = (baseline: number | null, current: number | null): WeeklyArrow => {
  if (baseline == null || current == null) return null;
  if (baseline === 0 && current === 0) return null;
  if (current === baseline) return 'level';
  return current > baseline ? 'up' : 'down';
};

const isWithin = (startedAt: string, start: Date, end: Date) => {
  const time = Date.parse(startedAt);
  return time >= start.getTime() && time < end.getTime();
};

/**
 * This week so far against last week up to the same moment, from server rows merged with this
 * device's sessions. Sums stay in metres and seconds; rounding happens once, at display.
 */
export const buildWeeklyStats = ({
  serverItems,
  localRows,
  deletions,
  now = new Date(),
  distanceUnit = 'km',
}: {
  serverItems: WeeklySessionItem[];
  localRows: LocalWeeklyRow[];
  deletions: PendingDeletionRow[];
  now?: Date;
  distanceUnit?: DistanceUnit;
}): WeeklyStats => {
  const { baselineStart, weekStart, nextWeekStart, baselineEnd } = weekBounds({ now });
  const sessions = mergeWeekSessions({ serverItems, localRows, deletions });
  const current = sumFigures(
    sessions.filter(({ startedAt }) => isWithin(startedAt, weekStart, nextWeekStart)),
  );
  const baseline = sumFigures(
    sessions.filter(({ startedAt }) => isWithin(startedAt, baselineStart, baselineEnd)),
  );
  const shown = displayWeeklyFigures({ figures: current, distanceUnit });
  const before = displayWeeklyFigures({ figures: baseline, distanceUnit });
  return {
    current,
    baseline,
    arrows: {
      sessions: compare(before.sessions, shown.sessions),
      distance: compare(before.distance, shown.distance),
      time: compare(before.minutes, shown.minutes),
      avgSpeed: compare(before.avgSpeed, shown.avgSpeed),
    },
  };
};

export const hasAnyArrow = (arrows: WeeklyArrows) => Object.values(arrows).some(Boolean);
