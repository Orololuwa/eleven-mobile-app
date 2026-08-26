import type { PlayStructure } from './types';

export const SEGMENT_LENGTH_MIN = 1;
export const SEGMENT_LENGTH_MAX = 180;

export const HALVES_PRESETS = [45, 35, 20] as const;
export const SETS_PRESETS = [20, 15, 10] as const;

export const validatePlannedSegmentLength = ({
  playStructure,
  minutes,
}: {
  playStructure: PlayStructure;
  minutes: number | null | undefined;
}) => {
  if (playStructure === 'open') {
    if (minutes != null) return 'Open sessions do not use a segment length';
    return undefined;
  }

  if (playStructure === 'halves') {
    if (minutes == null) return 'Segment length is required for halves';
  }

  if (minutes == null) return undefined;

  if (!Number.isInteger(minutes)) return 'Enter a whole number of minutes';
  if (minutes < SEGMENT_LENGTH_MIN || minutes > SEGMENT_LENGTH_MAX) {
    return `Segment length must be ${SEGMENT_LENGTH_MIN}–${SEGMENT_LENGTH_MAX} minutes`;
  }
  return undefined;
};

export const parseSegmentMinutesInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return NaN;
  return parsed;
};
