import type { SpeedBandBoundaries } from './summary/speed-bands';

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

export type SessionListMetrics = {
  active_duration_seconds: number;
  distance_m: number;
  top_speed_kmh: number | null;
  speed_source: 'os' | 'position_delta' | 'none';
  data_quality: 'good' | 'estimated' | 'insufficient';
};

export type SessionListItem = {
  id: string;
  /** Null means derive the title on the device. */
  title: string | null;
  session_type: SessionType;
  started_at: string;
  ended_at: string;
  pitch: { id: string; name: string } | null;
  /** Null when the session was finalized without metrics. */
  metrics: SessionListMetrics | null;
};

export type SessionListPage = {
  items: SessionListItem[];
  next_cursor: string | null;
  /** First page only. */
  total_count: number | null;
};

export type SessionCalendar = {
  month: string;
  days: { date: string; session_ids: string[] }[];
};

export type WeeklySessionMetrics = {
  active_duration_seconds: number;
  distance_m: number;
  data_quality: 'good' | 'estimated' | 'insufficient';
};

export type WeeklySessionItem = {
  id: string;
  started_at: string;
  /** Null when the session was finalized without metrics. */
  metrics: WeeklySessionMetrics | null;
};

export type WeeklySessionWindow = {
  start: string;
  end: string;
  items: WeeklySessionItem[];
};

export type SessionDetailSegment = {
  segment_index: number;
  activity_kind: ActivityKind | null;
  attack_direction: AttackDirection | null;
  started_at: string;
  ended_at: string | null;
};

export type SessionDetailSegmentMetrics = {
  segment_index: number;
  active_duration_seconds: number;
  distance_m: number;
  gap_seconds: number;
  top_speed_kmh: number | null;
  sprint_count: number;
  sprint_distance_m: number;
  zone_walk_seconds: number;
  zone_jog_seconds: number;
  zone_run_seconds: number;
  zone_high_run_seconds: number;
  zone_sprint_seconds: number;
  calories_kcal: number | null;
};

export type SessionDetailSprint = {
  segment_index: number;
  effort_index: number;
  duration_s: number;
  distance_m: number;
  peak_speed_kmh: number;
};

export type SessionDetailMetrics = {
  active_duration_seconds: number;
  distance_m: number;
  top_speed_kmh: number | null;
  sprint_count: number;
  sprint_distance_m: number;
  zone_walk_seconds: number;
  zone_jog_seconds: number;
  zone_run_seconds: number;
  zone_high_run_seconds: number;
  zone_sprint_seconds: number;
  calories_kcal: number | null;
  speed_source: 'os' | 'position_delta' | 'none';
  data_quality: 'good' | 'estimated' | 'insufficient';
  speed_band_bucket: string;
  speed_band_boundaries_kmh: SpeedBandBoundaries;
  pitch_long_axis_m: number | null;
  accepted_fix_count: number;
  gap_seconds: number;
};

export type SessionDetail = {
  id: string;
  title: string | null;
  session_type: SessionType;
  play_structure: PlayStructure;
  started_at: string;
  ended_at: string;
  pitch: { id: string; name: string } | null;
  segments: SessionDetailSegment[];
  metrics: SessionDetailMetrics | null;
  segment_metrics: SessionDetailSegmentMetrics[];
  sprint_efforts: SessionDetailSprint[];
};

/** Normalized kickoff payload for local tracking seed (API returns flat SessionRead). */
export type SessionStartOut = {
  session: SessionRead;
  segments: SessionSegment[];
};
