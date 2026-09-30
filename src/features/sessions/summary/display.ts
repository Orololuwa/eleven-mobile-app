import type { DistanceUnit } from '@/types/profile';
import {
  BAND_BUCKET_LABEL,
  BAND_SIZE_LABEL,
  type SpeedBandBucket,
  SpeedBandBoundaries,
} from './speed-bands';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const formatSummaryDate = (iso: string) => {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatSummaryDistance = ({ metres, unit }: { metres: number; unit: DistanceUnit }) => {
  const km = metres / 1000;
  const value = unit === 'mi' ? km * 0.621371 : km;
  return value.toFixed(1);
};

export const formatSummarySpeed = ({ kmh, unit }: { kmh: number; unit: DistanceUnit }) => {
  const value = unit === 'mi' ? kmh * 0.621371 : kmh;
  return value.toFixed(1);
};

export const distanceUnitLabel = (unit: DistanceUnit) => (unit === 'mi' ? 'MI' : 'KM');

export const speedUnitLabel = (unit: DistanceUnit) => (unit === 'mi' ? 'MPH' : 'KM/H');

export const formatActiveMinutes = (seconds: number) => String(Math.round(seconds / 60));

export const formatZoneClock = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.max(0, seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatSprintSeconds = (seconds: number) => seconds.toFixed(1);

export const sprintCaption = ({
  count,
  boundaries,
  bucket,
  unit,
}: {
  count: number;
  boundaries: SpeedBandBoundaries;
  bucket: SpeedBandBucket;
  unit: DistanceUnit;
}) => {
  const threshold = formatSummarySpeed({ kmh: boundaries.sprint_min_kmh, unit });
  const noun = count === 1 ? 'SPRINT' : 'SPRINTS';
  return `${count} ${noun} ABOVE ${threshold} ${speedUnitLabel(unit)} · ${BAND_BUCKET_LABEL[bucket]}`;
};

export const sizeLabel = (bucket: SpeedBandBucket) => BAND_SIZE_LABEL[bucket];

export const estimatedSignalCopy = ({
  gapSeconds,
  activeSeconds,
}: {
  gapSeconds: number;
  activeSeconds: number;
}) => {
  const activeMin = Math.max(1, Math.round(activeSeconds / 60));
  if (gapSeconds >= 60) {
    return `We lost your signal for about ${Math.round(gapSeconds / 60)} of your ${activeMin} minutes. Your time is exact — marked numbers will read a little low.`;
  }
  return `We lost your signal for about ${gapSeconds} seconds of your ${activeMin} minutes. Your time is exact — marked numbers will read a little low.`;
};

export const zoneRows = (boundaries: SpeedBandBoundaries) => [
  { key: 'walk' as const, label: 'WALK', range: `< ${boundaries.walk_max_kmh}` },
  {
    key: 'jog' as const,
    label: 'JOG',
    range: `${boundaries.walk_max_kmh} – ${boundaries.jog_max_kmh}`,
  },
  {
    key: 'run' as const,
    label: 'RUN',
    range: `${boundaries.jog_max_kmh} – ${boundaries.run_max_kmh}`,
  },
  {
    key: 'high_run' as const,
    label: 'HIGH RUN',
    range: `${boundaries.run_max_kmh} – ${boundaries.sprint_min_kmh}`,
  },
  { key: 'sprint' as const, label: 'SPRINT', range: `${boundaries.sprint_min_kmh}+` },
];
