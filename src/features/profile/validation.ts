import type { PositionIn, PreferredFoot, ProfileUpdate, Sex, SkillLevel } from './types';
import { parseIsoDate, startOfToday } from './date';

export const DISPLAY_NAME_MAX = 100;
export const BIO_MAX = 500;
export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 230;
/** Smallest positive value `numeric(4,1)` can store. */
export const WEIGHT_MIN_KG = 0.1;
/** Largest value `numeric(4,1)` can store. */
export const WEIGHT_MAX_KG = 999.9;
export const POSITION_MIN = 1;
export const POSITION_MAX = 5;

export const validateDisplayName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Display name is required';
  if (trimmed.length > DISPLAY_NAME_MAX) return `Max ${DISPLAY_NAME_MAX} characters`;
  return undefined;
};

export const validateBio = (value: string) => {
  if (value.length > BIO_MAX) return `Max ${BIO_MAX} characters`;
  return undefined;
};

export const validateDateOfBirth = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = parseIsoDate(trimmed);
  if (!date) return 'Enter a valid date';
  if (date > startOfToday()) return 'Date of birth cannot be in the future';
  return undefined;
};

export const roundWeightKg = (value: number) => Math.round(value * 10) / 10;

export const validateWeightKg = (value: number | null | undefined) => {
  if (value == null) return undefined;
  if (!Number.isFinite(value)) return 'Enter a weight';
  const rounded = roundWeightKg(value);
  if (Math.abs(rounded - value) > 0.001) return 'Use one decimal place';
  if (rounded < WEIGHT_MIN_KG) return 'Enter a weight';
  if (rounded > WEIGHT_MAX_KG) return `Enter a weight up to ${WEIGHT_MAX_KG} kg`;
  return undefined;
};

export const validateSex = (value: Sex | null | undefined) => {
  if (value == null) return undefined;
  if (value === 'male' || value === 'female' || value === 'prefer_not_to_say') return undefined;
  return 'Choose male, female, or prefer not to say';
};

export const validateHeightCm = (value: number | null | undefined) => {
  if (value == null) return undefined;
  if (!Number.isInteger(value)) return 'Height must be a whole number';
  if (value < HEIGHT_MIN || value > HEIGHT_MAX) {
    return `Height must be ${HEIGHT_MIN}–${HEIGHT_MAX} cm`;
  }
  return undefined;
};

export const ensureOnePreferred = (positions: PositionIn[]): PositionIn[] => {
  if (positions.length === 0) return positions;
  const preferredIndex = positions.findIndex((entry) => entry.is_preferred);
  const index = preferredIndex >= 0 ? preferredIndex : 0;
  return positions.map((entry, entryIndex) => ({
    position: entry.position,
    is_preferred: entryIndex === index,
  }));
};

export const validatePositionSet = (positions: PositionIn[]) => {
  if (positions.length < POSITION_MIN || positions.length > POSITION_MAX) {
    return `Select ${POSITION_MIN}–${POSITION_MAX} positions`;
  }

  const codes = positions.map((entry) => entry.position);
  if (new Set(codes).size !== codes.length) return 'Duplicate positions are not allowed';

  const preferredCount = positions.filter((entry) => entry.is_preferred).length;
  if (preferredCount !== 1) return 'Select exactly one preferred position';

  return undefined;
};

export const validateProfileUpdate = (update: ProfileUpdate) => {
  if (update.display_name != null) {
    const error = validateDisplayName(update.display_name);
    if (error) return error;
  }
  if (update.bio != null) {
    const error = validateBio(update.bio);
    if (error) return error;
  }
  if (update.date_of_birth) {
    const error = validateDateOfBirth(update.date_of_birth);
    if (error) return error;
  }
  if (update.height_cm != null) {
    const error = validateHeightCm(update.height_cm);
    if (error) return error;
  }
  if (update.weight_kg != null) {
    const error = validateWeightKg(update.weight_kg);
    if (error) return error;
  }
  if (update.sex != null) {
    const error = validateSex(update.sex);
    if (error) return error;
  }
  return undefined;
};

export const footLabel = (foot: PreferredFoot) =>
  ({ left: 'LEFT', right: 'RIGHT', both: 'BOTH' })[foot];

export const skillLabel = (skill: SkillLevel) => skill.toUpperCase();
