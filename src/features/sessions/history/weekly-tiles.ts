import type { DistanceUnit } from '@/types/profile';
import { distanceUnitLabel, speedUnitLabel } from '../summary/display';
import {
  displayWeeklyFigures,
  hasAnyArrow,
  type WeeklyArrow,
  type WeeklyStats,
} from './weekly-stats';

export type WeeklyTile = {
  key: 'sessions' | 'distance' | 'minutes' | 'avgSpeed';
  label: string;
  value: string;
  unit?: string;
  trend: WeeklyArrow;
  accessibilityLabel: string;
};

export type WeeklySectionView =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'ready'; tiles: WeeklyTile[]; showCaption: boolean };

export const WEEKLY_CAPTION = 'vs this point last week';

const TILE_LABELS: Record<WeeklyTile['key'], string> = {
  sessions: 'Sessions',
  distance: 'Distance',
  minutes: 'Minutes',
  avgSpeed: 'Avg speed',
};

const spokenUnits = (unit: DistanceUnit): Record<WeeklyTile['key'], string> => ({
  sessions: 'sessions',
  distance: unit === 'mi' ? 'miles' : 'kilometres',
  minutes: 'minutes',
  avgSpeed: unit === 'mi' ? 'miles per hour' : 'kilometres per hour',
});

const spokenTrend = ({ trend, baseline }: { trend: WeeklyArrow; baseline: string }) => {
  if (trend === 'up') return `, up from ${baseline} at this point last week`;
  if (trend === 'down') return `, down from ${baseline} at this point last week`;
  if (trend === 'level') return ', level with this point last week';
  return '';
};

const formatDecimal = (value: number | null) => (value == null ? '—' : value.toFixed(1));

/** Tile view models for the THIS WEEK section, values rounded exactly as compared. */
export const presentWeeklyTiles = ({
  stats,
  distanceUnit = 'km',
}: {
  stats: WeeklyStats;
  distanceUnit?: DistanceUnit;
}): WeeklyTile[] => {
  const current = displayWeeklyFigures({ figures: stats.current, distanceUnit });
  const baseline = displayWeeklyFigures({ figures: stats.baseline, distanceUnit });
  const spoken = spokenUnits(distanceUnit);
  const rows = [
    {
      key: 'sessions' as const,
      value: String(current.sessions),
      baseline: String(baseline.sessions),
      trend: stats.arrows.sessions,
    },
    {
      key: 'distance' as const,
      value: formatDecimal(current.distance),
      baseline: formatDecimal(baseline.distance),
      unit: distanceUnitLabel(distanceUnit),
      trend: stats.arrows.distance,
    },
    {
      key: 'minutes' as const,
      value: String(current.minutes),
      baseline: String(baseline.minutes),
      unit: 'MIN',
      trend: stats.arrows.time,
    },
    {
      key: 'avgSpeed' as const,
      value: formatDecimal(current.avgSpeed),
      baseline: formatDecimal(baseline.avgSpeed),
      unit: speedUnitLabel(distanceUnit),
      trend: stats.arrows.avgSpeed,
    },
  ];
  return rows.map(({ key, value, baseline: before, unit, trend }) => ({
    key,
    label: TILE_LABELS[key],
    value,
    unit,
    trend,
    accessibilityLabel: `${TILE_LABELS[key]}, ${
      value === '—'
        ? 'no data'
        : `${value} ${value === '1' ? spoken[key].replace(/s$/, '') : spoken[key]}`
    }${spokenTrend({ trend, baseline: before })}.`,
  }));
};

export const presentWeeklySection = ({
  state,
  distanceUnit = 'km',
}: {
  state: { status: 'loading' } | { status: 'offline' } | { status: 'ready'; stats: WeeklyStats };
  distanceUnit?: DistanceUnit;
}): WeeklySectionView =>
  state.status === 'ready'
    ? {
        status: 'ready',
        tiles: presentWeeklyTiles({ stats: state.stats, distanceUnit }),
        showCaption: hasAnyArrow(state.stats.arrows),
      }
    : state;

export const WEEKLY_TILE_KEYS = Object.keys(TILE_LABELS) as WeeklyTile['key'][];
export const weeklyTileLabel = (key: WeeklyTile['key']) => TILE_LABELS[key];
