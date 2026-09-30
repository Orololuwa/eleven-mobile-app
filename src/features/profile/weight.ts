import type { Sex } from './types';
import { roundWeightKg } from './validation';

const STALE_MS = 90 * 24 * 60 * 60 * 1000;
const LB_PER_KG = 2.2046226218;

export type WeightGateMode = 'missing' | 'stale';

export const weightGateMode = ({
  weightKg,
  weightUpdatedAt,
  now = Date.now(),
}: {
  weightKg: number | null | undefined;
  weightUpdatedAt: string | null | undefined;
  now?: number;
}): WeightGateMode | null => {
  if (weightKg == null) return 'missing';
  if (!weightUpdatedAt) return 'stale';
  const updatedMs = Date.parse(weightUpdatedAt);
  if (!Number.isFinite(updatedMs) || now - updatedMs > STALE_MS) return 'stale';
  return null;
};

export const kgToDisplay = (kg: number, unit: 'kg' | 'lb') => (unit === 'lb' ? kg * LB_PER_KG : kg);

export const displayToKg = (value: number, unit: 'kg' | 'lb') =>
  roundWeightKg(unit === 'lb' ? value / LB_PER_KG : value);

export const formatWeight = (kg: number, unit: 'kg' | 'lb') => {
  const shown = kgToDisplay(kg, unit);
  return unit === 'lb' ? shown.toFixed(0) : shown.toFixed(1);
};

export const weightUnitLabel = (unit: 'kg' | 'lb') => (unit === 'lb' ? 'LB' : 'KG');

export const sexLabel = (sex: Sex) =>
  sex === 'prefer_not_to_say' ? 'PREFER NOT TO SAY' : sex.toUpperCase();

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const formatWeightUpdated = (iso: string | null | undefined) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  return {
    day: `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
    month: MONTHS_LONG[date.getMonth()],
  };
};
