import type { ActivityKind, PlayStructure, SessionType } from './types';

export const SEGMENT_LENGTH_MIN = 1;
export const SEGMENT_LENGTH_MAX = 180;

export const HALVES_PRESETS = [45, 35, 20] as const;
export const SETS_PRESETS = [20, 15, 10] as const;
export const EXTRA_TIME_PRESETS = [15, 10, 5] as const;

export const ACTIVITY_KINDS: ActivityKind[] = ['run', 'drill', 'set'];

export const allowedPlayStructures = (sessionType: SessionType): PlayStructure[] => {
  if (sessionType === 'match') return ['halves'];
  if (sessionType === 'futsal') return ['halves', 'sets'];
  return ['training_activities'];
};

export const forcedPlayStructure = (sessionType: SessionType): PlayStructure | null => {
  const allowed = allowedPlayStructures(sessionType);
  return allowed.length === 1 ? (allowed[0] ?? null) : null;
};

export const validatePlannedSegmentLength = ({
  playStructure,
  minutes,
}: {
  playStructure: PlayStructure;
  minutes: number | null | undefined;
}) => {
  if (playStructure === 'training_activities') {
    if (minutes != null) return 'Training sessions do not use a segment length';
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

export const validateExtraTime = ({
  playStructure,
  enabled,
  minutes,
}: {
  playStructure: PlayStructure;
  enabled: boolean | null | undefined;
  minutes: number | null | undefined;
}) => {
  if (playStructure !== 'halves') {
    if (enabled === true) return 'Extra time is only available for halves';
    if (minutes != null) return 'Extra time length only applies when extra time is enabled';
    return undefined;
  }

  if (enabled == null) return 'Choose whether this session can go to extra time';

  if (!enabled) {
    if (minutes != null) return 'Extra time length only applies when extra time is enabled';
    return undefined;
  }

  if (minutes == null) return 'Extra time length is required when extra time is enabled';
  if (!Number.isInteger(minutes)) return 'Enter a whole number of minutes';
  if (minutes < SEGMENT_LENGTH_MIN || minutes > SEGMENT_LENGTH_MAX) {
    return `Extra time length must be ${SEGMENT_LENGTH_MIN}–${SEGMENT_LENGTH_MAX} minutes`;
  }
  return undefined;
};

export const validateTrainingActivityOptions = ({
  sessionType,
  options,
}: {
  sessionType: SessionType;
  options: ActivityKind[] | null | undefined;
}) => {
  if (sessionType !== 'training') {
    if (options != null && options.length > 0) {
      return 'Training activities only apply to training sessions';
    }
    return undefined;
  }

  if (!options?.length) return 'Select at least one activity';

  const invalid = options.find((option) => !ACTIVITY_KINDS.includes(option));
  if (invalid) return 'Invalid training activity';

  const unique = new Set(options);
  if (unique.size !== options.length) return 'Duplicate training activities are not allowed';

  return undefined;
};

export const parseSegmentMinutesInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return NaN;
  return parsed;
};
