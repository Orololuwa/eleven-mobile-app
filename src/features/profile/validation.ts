import type { PositionIn, PreferredFoot, ProfileUpdate, SkillLevel } from './types';

export const DISPLAY_NAME_MAX = 100;
export const BIO_MAX = 500;
export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 230;
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

export const validateHeightCm = (value: number | null | undefined) => {
  if (value == null) return undefined;
  if (!Number.isInteger(value)) return 'Height must be a whole number';
  if (value < HEIGHT_MIN || value > HEIGHT_MAX) {
    return `Height must be ${HEIGHT_MIN}–${HEIGHT_MAX} cm`;
  }
  return undefined;
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
  if (update.height_cm != null) {
    const error = validateHeightCm(update.height_cm);
    if (error) return error;
  }
  return undefined;
};

export const footLabel = (foot: PreferredFoot) =>
  ({ left: 'LEFT', right: 'RIGHT', both: 'BOTH' })[foot];

export const skillLabel = (skill: SkillLevel) => skill.toUpperCase();
