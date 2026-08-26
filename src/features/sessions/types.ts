export type SessionType = 'match' | 'training' | 'futsal';

export type PlayStructure = 'halves' | 'sets' | 'open';

export type AttackDirection = 'end_a' | 'end_b';

export type SessionCreate = {
  session_type: SessionType;
  play_structure: PlayStructure;
  planned_segment_length_minutes?: number | null;
  pitch_id?: string | null;
};

export type SessionSegment = {
  id: string;
  session_id: string;
  segment_index: number;
  attack_direction: AttackDirection | null;
  started_at: string;
  ended_at: string | null;
};

export type SessionRead = {
  id: string;
  user_id: string;
  session_type: SessionType;
  play_structure: PlayStructure;
  planned_segment_length_minutes: number | null;
  pitch_id: string | null;
  created_at: string;
  started_at: string | null;
};

export type SessionStartIn = {
  attack_direction?: AttackDirection | null;
};

export type SessionStartOut = {
  session: SessionRead;
  segments: SessionSegment[];
};
