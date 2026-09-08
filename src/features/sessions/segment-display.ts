import type { ActivityKind, PlayStructure, SessionType } from './types';

type SegmentLike = {
  segment_index: number;
  activity_kind?: ActivityKind | null;
};

type SessionLike = {
  session_type: SessionType;
  play_structure: PlayStructure | 'open';
  planned_segment_length_minutes?: number | null;
  planned_extra_time_segment_length_minutes?: number | null;
  pitch_id?: string | null;
};

export const normalizePlayStructure = (
  playStructure: PlayStructure | 'open' | null | undefined,
): PlayStructure => {
  if (playStructure === 'open' || playStructure == null) return 'training_activities';
  return playStructure;
};

export const halvesPhaseLabel = (segmentIndex: number): string => {
  if (segmentIndex === 1) return '1ST HALF';
  if (segmentIndex === 2) return '2ND HALF';
  if (segmentIndex === 3) return 'ET 1';
  if (segmentIndex === 4) return 'ET 2';
  return `SEGMENT ${segmentIndex}`;
};

export const halvesPhaseLabelLong = (segmentIndex: number): string => {
  if (segmentIndex === 1) return 'FIRST HALF';
  if (segmentIndex === 2) return 'SECOND HALF';
  if (segmentIndex === 3) return 'ET 1';
  if (segmentIndex === 4) return 'ET 2';
  return `SEGMENT ${segmentIndex}`;
};

export const activityKindLabel = (kind: ActivityKind): string => {
  if (kind === 'run') return 'RUN';
  if (kind === 'drill') return 'DRILL';
  return 'SET';
};

export const trainingSegmentLabel = ({
  activityKind,
  occurrence,
}: {
  activityKind: ActivityKind | null | undefined;
  occurrence: number;
}): string => {
  if (!activityKind) return 'TRAINING';
  return `${activityKindLabel(activityKind)} ${occurrence}`;
};

export const countActivityOccurrence = ({
  segments,
  upToIndex,
  activityKind,
}: {
  segments: SegmentLike[];
  upToIndex: number;
  activityKind: ActivityKind | null | undefined;
}): number => {
  if (!activityKind) return 1;
  return segments.filter(
    (segment) => segment.segment_index <= upToIndex && segment.activity_kind === activityKind,
  ).length;
};

export const segmentLabelFor = ({
  session,
  segment,
  allSegments = [],
}: {
  session: SessionLike;
  segment: SegmentLike | null;
  allSegments?: SegmentLike[];
}): string => {
  const playStructure = normalizePlayStructure(session.play_structure);
  if (playStructure === 'training_activities') {
    if (!segment) return 'REST';
    const occurrence = countActivityOccurrence({
      segments: allSegments.length > 0 ? allSegments : [segment],
      upToIndex: segment.segment_index,
      activityKind: segment.activity_kind,
    });
    return trainingSegmentLabel({
      activityKind: segment.activity_kind,
      occurrence,
    });
  }
  if (!segment) return 'SESSION';
  if (playStructure === 'halves') return halvesPhaseLabel(segment.segment_index);
  return `SET ${segment.segment_index}`;
};

export const plannedMinutesForSegment = ({
  session,
  segment,
}: {
  session: SessionLike;
  segment: SegmentLike | null;
}): number | null => {
  const playStructure = normalizePlayStructure(session.play_structure);
  if (playStructure === 'training_activities') return null;
  if (!segment) return session.planned_segment_length_minutes ?? null;
  if (playStructure === 'halves' && segment.segment_index >= 3) {
    return session.planned_extra_time_segment_length_minutes ?? null;
  }
  return session.planned_segment_length_minutes ?? null;
};

export const shouldResolveAttackDirection = ({
  sessionType,
  activityKind,
  pitchId,
}: {
  sessionType: SessionType;
  activityKind?: ActivityKind | null;
  pitchId?: string | null;
}): boolean => {
  if (!pitchId) return false;
  if (sessionType === 'training') return activityKind === 'set';
  return true;
};

export const nextHalvesSegmentIndex = (currentIndex: number) => currentIndex + 1;

export const canAddExtraTime = ({
  playStructure,
  extraTimeEnabled,
  currentSegmentIndex,
}: {
  playStructure: PlayStructure | 'open';
  extraTimeEnabled: boolean | null | undefined;
  currentSegmentIndex: number;
}): boolean => {
  if (normalizePlayStructure(playStructure) !== 'halves') return false;
  if (!extraTimeEnabled) return false;
  return currentSegmentIndex >= 2 && currentSegmentIndex < 4;
};

export const canSwitchHalf = ({
  playStructure,
  currentSegmentIndex,
}: {
  playStructure: PlayStructure | 'open';
  currentSegmentIndex: number;
}): boolean => {
  if (normalizePlayStructure(playStructure) !== 'halves') return false;
  return currentSegmentIndex === 1;
};
