import type { ActivityKind, AttackDirection, PlayStructure, SessionType } from '../types';
import type { LocationIn } from '@/features/pitches/types';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'rejected';

export type PauseReason = 'manual' | 'gps_loss' | 'backgrounded';

export type TrackingStatus = 'live' | 'manual_pause' | 'auto_pause' | 'ended';

export type BackgroundPermission = 'always' | 'when_in_use';

export type TrackingPhase = 'permission' | 'tracking' | 'segment-switch';

export type StoredPitchCorners = {
  end_a_corner_1: LocationIn;
  end_a_corner_2: LocationIn;
  end_b_corner_1: LocationIn;
  end_b_corner_2: LocationIn;
};

export type TrackingSessionRow = {
  id: string;
  session_type: SessionType;
  play_structure: PlayStructure;
  planned_segment_length_minutes: number | null;
  extra_time_enabled: number | null;
  planned_extra_time_segment_length_minutes: number | null;
  training_activity_options: string | null;
  pitch_id: string | null;
  pitch_name: string | null;
  end_a_corner_1_lat: number | null;
  end_a_corner_1_lng: number | null;
  end_a_corner_2_lat: number | null;
  end_a_corner_2_lng: number | null;
  end_b_corner_1_lat: number | null;
  end_b_corner_1_lng: number | null;
  end_b_corner_2_lat: number | null;
  end_b_corner_2_lng: number | null;
  started_at: string;
  ended_at: string | null;
  sync_status: SyncStatus;
  sync_attempts: number;
  last_sync_attempt_at: string | null;
  tracking_status: TrackingStatus;
  last_accepted_fix_at: string | null;
  auto_resume_cooldown_until: string | null;
  background_permission: BackgroundPermission;
  live_activity_id: string | null;
  next_sequence_index: number;
  segment_clock_origin_ms: number;
  current_segment_id: string | null;
  gps_search_started_at: string | null;
};

export type TrackingSegmentRow = {
  id: string;
  session_id: string;
  segment_index: number;
  attack_direction: AttackDirection | null;
  activity_kind: ActivityKind | null;
  started_at: string;
  ended_at: string | null;
};

export type TrackingPauseRow = {
  id: string;
  session_id: string;
  segment_id: string;
  reason: PauseReason;
  started_at: string;
  ended_at: string | null;
};

export type TrackingPointRow = {
  id: string;
  session_id: string;
  segment_id: string;
  sequence_index: number;
  recorded_at: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  speed_accuracy_mps: number | null;
  horizontal_accuracy_m: number | null;
};

export type SessionFinalizeSegment = {
  segment_index: number;
  attack_direction: AttackDirection | null;
  activity_kind: ActivityKind | null;
  started_at: string;
  ended_at: string;
};

export type SessionFinalizePause = {
  segment_index: number;
  reason: PauseReason;
  started_at: string;
  ended_at: string;
};

export type SessionFinalizeLocation = {
  lat: number;
  lng: number;
};

export type SessionMetricsPayload = {
  active_duration_seconds: number;
  distance_m: number;
  top_speed_kmh: number | null;
  top_speed_location: SessionFinalizeLocation | null;
  sprint_count: number;
  sprint_distance_m: number;
  zone_walk_seconds: number;
  zone_jog_seconds: number;
  zone_run_seconds: number;
  zone_high_run_seconds: number;
  zone_sprint_seconds: number;
  calories_kcal: number | null;
  mass_kg_at_computation: number | null;
  speed_source: string;
  data_quality: string;
  speed_band_bucket: string;
  speed_band_boundaries_kmh: {
    walk_max_kmh: number;
    jog_max_kmh: number;
    run_max_kmh: number;
    high_run_max_kmh: number;
    sprint_min_kmh: number;
  };
  pitch_long_axis_m: number | null;
  accepted_fix_count: number;
  gap_seconds: number;
  algorithm_version: string;
  computed_at: string;
};

export type SegmentMetricsPayload = {
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

export type SprintEffortPayload = {
  segment_index: number;
  effort_index: number;
  started_at: string;
  ended_at: string;
  duration_s: number;
  distance_m: number;
  peak_speed_kmh: number;
  peak_location: SessionFinalizeLocation | null;
};

export type SessionFinalizeBody = {
  ended_at: string;
  segments: SessionFinalizeSegment[];
  pauses: SessionFinalizePause[];
  session_metrics?: SessionMetricsPayload;
  segment_metrics?: SegmentMetricsPayload[];
  sprint_efforts?: SprintEffortPayload[];
};

export type TrackPointUpload = {
  sequence_index: number;
  segment_index: number;
  recorded_at: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  speed_accuracy_mps: number | null;
  horizontal_accuracy_m: number;
};

export type TrackPointsBody = {
  points: TrackPointUpload[];
};

export type LiveMetrics = {
  distanceKm: number;
  topSpeedKmh: number;
};

export const parseTrainingActivityOptions = (value: string | null | undefined): ActivityKind[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ActivityKind => item === 'run' || item === 'drill' || item === 'set',
    );
  } catch {
    return [];
  }
};

export const serializeTrainingActivityOptions = (options: ActivityKind[]): string | null => {
  if (!options.length) return null;
  return JSON.stringify(options);
};

export const isExtraTimeEnabled = (value: number | boolean | null | undefined): boolean =>
  value === true || value === 1;
