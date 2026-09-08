export type SessionType = 'match' | 'training' | 'futsal';

export type PlayStructure = 'halves' | 'sets' | 'training_activities';

export type ActivityKind = 'run' | 'drill' | 'set';

export type AttackDirection = 'end_a' | 'end_b';

export type SessionCreate = {
  session_type: SessionType;
  play_structure: PlayStructure;
  planned_segment_length_minutes?: number | null;
  extra_time_enabled?: boolean | null;
  planned_extra_time_segment_length_minutes?: number | null;
  training_activity_options?: ActivityKind[] | null;
  pitch_id?: string | null;
};

export type SessionSegment = {
  id: string;
  session_id: string;
  segment_index: number;
  attack_direction: AttackDirection | null;
  activity_kind?: ActivityKind | null;
  started_at: string;
  ended_at: string | null;
};

export type SessionRead = {
  id: string;
  user_id: string;
  session_type: SessionType;
  play_structure: PlayStructure;
  planned_segment_length_minutes: number | null;
  extra_time_enabled?: boolean | null;
  planned_extra_time_segment_length_minutes?: number | null;
  training_activity_options?: ActivityKind[] | null;
  pitch_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at?: string | null;
  /** Present on start / read responses from the API. */
  segments?: SessionSegment[];
};

export type SessionStartIn = {
  attack_direction?: AttackDirection | null;
  /** Required by the API when `play_structure = training_activities`. */
  activity_kind?: ActivityKind | null;
};

/** Normalized kickoff payload for local tracking seed (API returns flat SessionRead). */
export type SessionStartOut = {
  session: SessionRead;
  segments: SessionSegment[];
};
