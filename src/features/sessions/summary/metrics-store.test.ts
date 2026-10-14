import { describe, expect, it } from 'vitest';
import type { StoredSegmentMetrics, StoredSessionMetrics } from './metrics-store';
import {
  parseBandBoundaries,
  toSegmentMetricsPayload,
  toSessionMetricsPayload,
} from './metrics-payload';

const boundaries = { walk: 7, jog: 10, run: 14, high_run: 17, sprint: 17 };

const storedSession = (overrides: Partial<StoredSessionMetrics> = {}): StoredSessionMetrics => ({
  session_id: 'session-1',
  active_duration_seconds: 1200,
  distance_m: 3000,
  top_speed_kmh: 24,
  top_speed_lat: 6.45,
  top_speed_lng: 3.39,
  sprint_count: 2,
  sprint_distance_m: 40,
  zone_walk_seconds: 400,
  zone_jog_seconds: 300,
  zone_run_seconds: 200,
  zone_high_run_seconds: 80,
  zone_sprint_seconds: 20,
  calories_kcal: 500,
  mass_kg_at_computation: 75,
  speed_source: 'os',
  data_quality: 'good',
  speed_band_bucket: 'small',
  speed_band_boundaries_json: JSON.stringify(boundaries),
  pitch_long_axis_m: 55,
  accepted_fix_count: 800,
  continuity_fix_count: 700,
  gap_seconds: 30,
  algorithm_version: 'v2',
  computed_at: '2026-10-14T10:00:00.000Z',
  ...overrides,
});

const storedSegment = (): StoredSegmentMetrics => ({
  id: 'segment-metrics-1',
  session_id: 'session-1',
  segment_id: 'segment-1',
  active_duration_seconds: 1200,
  distance_m: 3000,
  gap_seconds: 30,
  top_speed_kmh: 24,
  sprint_count: 2,
  sprint_distance_m: 40,
  zone_walk_seconds: 400,
  zone_jog_seconds: 300,
  zone_run_seconds: 200,
  zone_high_run_seconds: 80,
  zone_sprint_seconds: 20,
  calories_kcal: 500,
});

describe('parseBandBoundaries', () => {
  it('keeps the API field names', () => {
    expect(parseBandBoundaries(JSON.stringify(boundaries))).toEqual(boundaries);
  });

  it('reads sessions stored before the field rename', () => {
    expect(
      parseBandBoundaries(
        JSON.stringify({
          walk_max_kmh: 7,
          jog_max_kmh: 10,
          run_max_kmh: 14,
          high_run_max_kmh: 17,
          sprint_min_kmh: 17,
        }),
      ),
    ).toEqual(boundaries);
  });
});

describe('toSessionMetricsPayload', () => {
  it('sends speed-band thresholds under the API names', () => {
    const payload = toSessionMetricsPayload(
      storedSession({
        speed_band_boundaries_json: JSON.stringify({
          walk_max_kmh: 7,
          jog_max_kmh: 12,
          run_max_kmh: 16,
          high_run_max_kmh: 20,
          sprint_min_kmh: 20,
        }),
      }),
    );

    expect(payload.speed_band_boundaries_kmh).toEqual({
      walk: 7,
      jog: 12,
      run: 16,
      high_run: 20,
      sprint: 20,
    });
    expect(payload).not.toHaveProperty('continuity_fix_count');
  });

  it('nulls speed-derived fields when no speed was recorded', () => {
    const payload = toSessionMetricsPayload(
      storedSession({
        speed_source: 'none',
        top_speed_kmh: 0,
        sprint_count: 0,
        sprint_distance_m: 0,
        zone_walk_seconds: 0,
        zone_jog_seconds: 0,
        zone_run_seconds: 0,
        zone_high_run_seconds: 0,
        zone_sprint_seconds: 0,
      }),
    );

    expect(payload.top_speed_kmh).toBeNull();
    expect(payload.top_speed_location).toBeNull();
    expect(payload.sprint_count).toBeNull();
    expect(payload.sprint_distance_m).toBeNull();
    expect(payload.zone_walk_seconds).toBeNull();
    expect(payload.zone_sprint_seconds).toBeNull();
    expect(toSegmentMetricsPayload(storedSegment(), 1, 'none').sprint_count).toBeNull();
  });
});
