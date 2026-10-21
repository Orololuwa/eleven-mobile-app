import { createTrackingId } from '../tracking/id';
import { withDb } from '../tracking/db';
import type { ComputedSessionMetrics, DataQuality, SpeedSource } from './types';

export type StoredSessionMetrics = {
  session_id: string;
  active_duration_seconds: number;
  distance_m: number;
  top_speed_kmh: number | null;
  top_speed_lat: number | null;
  top_speed_lng: number | null;
  sprint_count: number;
  sprint_distance_m: number;
  zone_walk_seconds: number;
  zone_jog_seconds: number;
  zone_run_seconds: number;
  zone_high_run_seconds: number;
  zone_sprint_seconds: number;
  calories_kcal: number | null;
  mass_kg_at_computation: number | null;
  speed_source: SpeedSource;
  data_quality: DataQuality;
  speed_band_bucket: string;
  speed_band_boundaries_json: string;
  pitch_long_axis_m: number | null;
  accepted_fix_count: number;
  /** Null for metrics computed before `v2`. */
  continuity_fix_count: number | null;
  gap_seconds: number;
  algorithm_version: string;
  computed_at: string;
};

export type StoredSegmentMetrics = {
  id: string;
  session_id: string;
  segment_id: string;
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

export type StoredSprintEffort = {
  id: string;
  session_id: string;
  segment_id: string;
  effort_index: number;
  started_at: string;
  ended_at: string;
  duration_s: number;
  distance_m: number;
  peak_speed_kmh: number;
  peak_lat: number | null;
  peak_lng: number | null;
};

export const saveComputedMetrics = async ({
  sessionId,
  computed,
}: {
  sessionId: string;
  computed: ComputedSessionMetrics;
}) => {
  const boundaries = JSON.stringify(computed.speedBandBoundaries);
  await withDb(async (db) => {
    await db.runAsync(`DELETE FROM sprint_efforts WHERE session_id = ?`, [sessionId]);
    await db.runAsync(`DELETE FROM segment_metrics WHERE session_id = ?`, [sessionId]);
    await db.runAsync(`DELETE FROM session_metrics WHERE session_id = ?`, [sessionId]);
    await db.runAsync(
      `INSERT INTO session_metrics (
        session_id, active_duration_seconds, distance_m, top_speed_kmh, top_speed_lat, top_speed_lng,
        sprint_count, sprint_distance_m, zone_walk_seconds, zone_jog_seconds, zone_run_seconds,
        zone_high_run_seconds, zone_sprint_seconds, calories_kcal, mass_kg_at_computation,
        speed_source, data_quality, speed_band_bucket, speed_band_boundaries_json, pitch_long_axis_m,
        accepted_fix_count, continuity_fix_count, gap_seconds, algorithm_version, computed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        computed.activeDurationSeconds,
        computed.distanceM,
        computed.topSpeedKmh,
        computed.topSpeedLat,
        computed.topSpeedLng,
        computed.sprintCount,
        computed.sprintDistanceM,
        computed.zones.walk,
        computed.zones.jog,
        computed.zones.run,
        computed.zones.high_run,
        computed.zones.sprint,
        computed.caloriesKcal,
        computed.massKgAtComputation,
        computed.speedSource,
        computed.dataQuality,
        computed.speedBandBucket,
        boundaries,
        computed.pitchLongAxisM,
        computed.acceptedFixCount,
        computed.continuityFixCount,
        computed.gapSeconds,
        computed.algorithmVersion,
        computed.computedAt,
      ],
    );

    for (const segment of computed.segments) {
      await db.runAsync(
        `INSERT INTO segment_metrics (
          id, session_id, segment_id, active_duration_seconds, distance_m, gap_seconds, top_speed_kmh,
          sprint_count, sprint_distance_m, zone_walk_seconds, zone_jog_seconds, zone_run_seconds,
          zone_high_run_seconds, zone_sprint_seconds, calories_kcal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createTrackingId(),
          sessionId,
          segment.segmentId,
          segment.activeDurationSeconds,
          segment.distanceM,
          segment.gapSeconds,
          segment.topSpeedKmh,
          segment.sprintCount,
          segment.sprintDistanceM,
          segment.zones.walk,
          segment.zones.jog,
          segment.zones.run,
          segment.zones.high_run,
          segment.zones.sprint,
          segment.caloriesKcal,
        ],
      );
    }

    for (const sprint of computed.sprints) {
      await db.runAsync(
        `INSERT INTO sprint_efforts (
          id, session_id, segment_id, effort_index, started_at, ended_at, duration_s, distance_m,
          peak_speed_kmh, peak_lat, peak_lng
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createTrackingId(),
          sessionId,
          sprint.segmentId,
          sprint.effortIndex,
          sprint.startedAt,
          sprint.endedAt,
          sprint.durationS,
          sprint.distanceM,
          sprint.peakSpeedKmh,
          sprint.peakLat,
          sprint.peakLng,
        ],
      );
    }
  });
};

export const getStoredSessionMetrics = (sessionId: string) =>
  withDb((db) =>
    db.getFirstAsync<StoredSessionMetrics>(`SELECT * FROM session_metrics WHERE session_id = ?`, [
      sessionId,
    ]),
  );

export const getStoredSegmentMetrics = (sessionId: string) =>
  withDb((db) =>
    db.getAllAsync<StoredSegmentMetrics>(
      `SELECT * FROM segment_metrics WHERE session_id = ? ORDER BY id ASC`,
      [sessionId],
    ),
  );

export const getStoredSprintEfforts = (sessionId: string) =>
  withDb((db) =>
    db.getAllAsync<StoredSprintEffort>(
      `SELECT * FROM sprint_efforts WHERE session_id = ? ORDER BY distance_m DESC, effort_index ASC`,
      [sessionId],
    ),
  );

export {
  parseBandBoundaries,
  toSegmentMetricsPayload,
  toSessionMetricsPayload,
  toSprintEffortPayload,
} from './metrics-payload';

export type MetricsComparison = {
  sessionId: string;
  computedAt: string;
  storedVersion: string;
  v3DistanceM: number;
  v3LiveDistanceM: number;
  v2DistanceM: number;
  dopplerDistanceM: number;
  v3TopSpeedKmh: number | null;
  v2TopSpeedKmh: number | null;
  v3DataQuality: string;
  v2DataQuality: string;
  v3AcceptedFixCount: number;
  v2AcceptedFixCount: number;
};

/** Amendment 03 §4 validation record, one row per session, device-local. */
export const saveMetricsComparison = async (row: MetricsComparison) => {
  await withDb((db) =>
    db.runAsync(
      `INSERT OR REPLACE INTO metrics_comparisons (
        session_id, computed_at, stored_version, v3_distance_m, v3_live_distance_m, v2_distance_m,
        doppler_distance_m, v3_top_speed_kmh, v2_top_speed_kmh, v3_data_quality, v2_data_quality,
        v3_accepted_fix_count, v2_accepted_fix_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.sessionId,
        row.computedAt,
        row.storedVersion,
        row.v3DistanceM,
        row.v3LiveDistanceM,
        row.v2DistanceM,
        row.dopplerDistanceM,
        row.v3TopSpeedKmh,
        row.v2TopSpeedKmh,
        row.v3DataQuality,
        row.v2DataQuality,
        row.v3AcceptedFixCount,
        row.v2AcceptedFixCount,
      ],
    ),
  );
};
