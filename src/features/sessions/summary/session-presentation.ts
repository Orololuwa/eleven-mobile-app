import type { SessionType } from '../types';
import type { DataQuality, SpeedSource } from './types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  match: 'Match',
  training: 'Training',
  futsal: 'Futsal',
};

/** Local-time part of day for a kickoff hour (0–23). Boundaries: 05, 12, 17, 21. */
export const partOfDay = (hour: number) => {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
};

/** `{Weekday} {Part of day} {Type}` from the local kickoff time. Never stored. */
export const deriveSessionTitle = ({
  startedAt,
  sessionType,
}: {
  startedAt: string;
  sessionType: SessionType;
}) => {
  const date = new Date(startedAt);
  return `${WEEKDAYS[date.getDay()]} ${partOfDay(date.getHours())} ${SESSION_TYPE_LABEL[sessionType]}`;
};

/** Pending rename (including an explicit clear) wins, then the stored override, then derived. */
export const displaySessionTitle = ({
  startedAt,
  sessionType,
  title = null,
  pendingTitle,
}: {
  startedAt: string;
  sessionType: SessionType;
  title?: string | null;
  pendingTitle?: string | null;
}) => {
  const override = pendingTitle === undefined ? title : pendingTitle;
  return override ?? deriveSessionTitle({ startedAt, sessionType });
};

/** `27 SEP`, or `27 SEP 2025` outside the current year. */
export const formatHistoryDate = ({
  startedAt,
  now = new Date(),
}: {
  startedAt: string;
  now?: Date;
}) => {
  const date = new Date(startedAt);
  const day = String(date.getDate()).padStart(2, '0');
  const base = `${day} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
};

export const formatHistoryMeta = ({
  startedAt,
  pitchName = null,
  sessionType,
  now = new Date(),
}: {
  startedAt: string;
  pitchName?: string | null;
  sessionType: SessionType;
  now?: Date;
}) =>
  [formatHistoryDate({ startedAt, now }), pitchName?.toUpperCase(), sessionType.toUpperCase()]
    .filter(Boolean)
    .join(' · ');

export type PresentableMetrics = {
  distance_m: number;
  top_speed_kmh: number | null;
  sprint_count?: number;
  calories_kcal?: number | null;
  speed_source: SpeedSource;
  data_quality: DataQuality;
};

export type MetricView =
  { kind: 'value'; value: number; estimated: boolean } | { kind: 'suppressed' };

export type SessionPresentation =
  | { kind: 'no_metrics' }
  | { kind: 'insufficient' }
  | {
      kind: 'metrics';
      distance: MetricView;
      topSpeed: MetricView;
      sprintCount: MetricView;
      calories: MetricView;
    };

const valueOf = (value: number | null | undefined, estimated: boolean): MetricView =>
  value == null ? { kind: 'suppressed' } : { kind: 'value', value, estimated };

/**
 * The one place that decides whether a stored metric is shown, marked estimated, or suppressed.
 * History rows and the summary both read from it.
 */
export const presentSessionMetrics = (metrics: PresentableMetrics | null): SessionPresentation => {
  if (!metrics) return { kind: 'no_metrics' };
  if (metrics.data_quality === 'insufficient') return { kind: 'insufficient' };
  const estimated = metrics.data_quality === 'estimated';
  const noSpeed = metrics.speed_source === 'none';
  return {
    kind: 'metrics',
    distance: valueOf(metrics.distance_m, estimated),
    topSpeed: noSpeed ? { kind: 'suppressed' } : valueOf(metrics.top_speed_kmh, false),
    sprintCount: noSpeed ? { kind: 'suppressed' } : valueOf(metrics.sprint_count, estimated),
    calories: valueOf(metrics.calories_kcal, estimated || noSpeed),
  };
};

export const INSUFFICIENT_ROW_COPY = "Couldn't track this one properly";
export const NO_STATS_COPY = 'No stats for this session';
