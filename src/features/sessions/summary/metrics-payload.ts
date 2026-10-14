import type {
  SegmentMetricsPayload,
  SessionMetricsPayload,
  SprintEffortPayload,
} from '../tracking/types';
import type { SpeedBandBoundaries } from './speed-bands';
import type { SpeedSource } from './types';
import type { StoredSegmentMetrics, StoredSessionMetrics, StoredSprintEffort } from './metrics-store';

const locationOf = (lat: number | null, lng: number | null) =>
  lat == null || lng == null ? null : { lat, lng };

const positiveNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/**
 * Reads boundaries stored on the device. Newer rows use the API names
 * (`walk`, `jog`, `run`, `high_run`, `sprint`). Older rows used
 * `walk_max_kmh` … `sprint_min_kmh`.
 */
export const parseBandBoundaries = (json: string): SpeedBandBoundaries => {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const walk = positiveNumber(parsed.walk) ?? positiveNumber(parsed.walk_max_kmh);
  const jog = positiveNumber(parsed.jog) ?? positiveNumber(parsed.jog_max_kmh);
  const run = positiveNumber(parsed.run) ?? positiveNumber(parsed.run_max_kmh);
  const highRun = positiveNumber(parsed.high_run) ?? positiveNumber(parsed.high_run_max_kmh);
  const sprint = positiveNumber(parsed.sprint) ?? positiveNumber(parsed.sprint_min_kmh);
  if (walk == null || jog == null || run == null || highRun == null || sprint == null) {
    throw new Error('speed band boundaries are missing');
  }
  return { walk, jog, run, high_run: highRun, sprint };
};

const speedValue = <T>(speedSource: SpeedSource, value: T): T | null =>
  speedSource === 'none' ? null : value;

export const toSessionMetricsPayload = (row: StoredSessionMetrics): SessionMetricsPayload => {
  const { speed_source: speedSource } = row;
  return {
    active_duration_seconds: row.active_duration_seconds,
    distance_m: row.distance_m,
    top_speed_kmh: speedValue(speedSource, row.top_speed_kmh),
    top_speed_location: speedValue(speedSource, locationOf(row.top_speed_lat, row.top_speed_lng)),
    sprint_count: speedValue(speedSource, row.sprint_count),
    sprint_distance_m: speedValue(speedSource, row.sprint_distance_m),
    zone_walk_seconds: speedValue(speedSource, row.zone_walk_seconds),
    zone_jog_seconds: speedValue(speedSource, row.zone_jog_seconds),
    zone_run_seconds: speedValue(speedSource, row.zone_run_seconds),
    zone_high_run_seconds: speedValue(speedSource, row.zone_high_run_seconds),
    zone_sprint_seconds: speedValue(speedSource, row.zone_sprint_seconds),
    calories_kcal: row.calories_kcal,
    mass_kg_at_computation: row.mass_kg_at_computation,
    speed_source: speedSource,
    data_quality: row.data_quality,
    speed_band_bucket: row.speed_band_bucket,
    speed_band_boundaries_kmh: parseBandBoundaries(row.speed_band_boundaries_json),
    pitch_long_axis_m: row.pitch_long_axis_m,
    accepted_fix_count: row.accepted_fix_count,
    gap_seconds: row.gap_seconds,
    algorithm_version: row.algorithm_version,
    computed_at: row.computed_at,
  };
};

export const toSegmentMetricsPayload = (
  row: StoredSegmentMetrics,
  segmentIndex: number,
  speedSource: SpeedSource,
): SegmentMetricsPayload => ({
  segment_index: segmentIndex,
  active_duration_seconds: row.active_duration_seconds,
  distance_m: row.distance_m,
  gap_seconds: row.gap_seconds,
  top_speed_kmh: speedValue(speedSource, row.top_speed_kmh),
  sprint_count: speedValue(speedSource, row.sprint_count),
  sprint_distance_m: speedValue(speedSource, row.sprint_distance_m),
  zone_walk_seconds: speedValue(speedSource, row.zone_walk_seconds),
  zone_jog_seconds: speedValue(speedSource, row.zone_jog_seconds),
  zone_run_seconds: speedValue(speedSource, row.zone_run_seconds),
  zone_high_run_seconds: speedValue(speedSource, row.zone_high_run_seconds),
  zone_sprint_seconds: speedValue(speedSource, row.zone_sprint_seconds),
  calories_kcal: row.calories_kcal,
});

export const toSprintEffortPayload = (
  row: StoredSprintEffort,
  segmentIndex: number,
): SprintEffortPayload => ({
  segment_index: segmentIndex,
  effort_index: row.effort_index,
  started_at: row.started_at,
  ended_at: row.ended_at,
  duration_s: row.duration_s,
  distance_m: row.distance_m,
  peak_speed_kmh: row.peak_speed_kmh,
  peak_location: locationOf(row.peak_lat, row.peak_lng),
});
