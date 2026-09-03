import type { AttackDirection, PlayStructure, SessionType } from '../types';
import type { LocationIn } from '@/features/pitches/types';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

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
  started_at: string;
  ended_at: string | null;
};

export type TrackingPauseRow = {
  id: string;
  session_id: string;
  segment_id: string | null;
  reason: PauseReason;
  started_at: string;
  ended_at: string | null;
};

export type TrackingPointRow = {
  id: string;
  session_id: string;
  segment_id: string | null;
  sequence_index: number;
  recorded_at: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  horizontal_accuracy_m: number | null;
};

export type SessionFinalizeSegment = {
  segment_index: number;
  attack_direction: AttackDirection | null;
  started_at: string;
  ended_at: string;
};

export type SessionFinalizePause = {
  segment_index: number | null;
  reason: PauseReason;
  started_at: string;
  ended_at: string;
};

export type SessionFinalizeBody = {
  ended_at: string;
  segments: SessionFinalizeSegment[];
  pauses: SessionFinalizePause[];
};

export type TrackPointUpload = {
  sequence_index: number;
  segment_index: number | null;
  recorded_at: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  horizontal_accuracy_m: number;
};

export type TrackPointsBody = {
  points: TrackPointUpload[];
};

export type LiveMetrics = {
  distanceKm: number;
  topSpeedKmh: number;
};
