import { normalizePlayStructure, segmentLabelFor } from '../segment-display';
import type { PlayStructure, SessionDetail, SessionType } from '../types';
import type { SyncStatus } from '../tracking/types';
import { getSegmentsForSession, getTrackingSession } from '../tracking/db';
import {
  getStoredSegmentMetrics,
  getStoredSessionMetrics,
  getStoredSprintEfforts,
  parseBandBoundaries,
} from './metrics-store';
import type { SpeedBandBoundaries, SpeedBandBucket } from './speed-bands';
import type { DataQuality, SpeedSource, ZoneSeconds } from './types';

export type SummarySegmentView = {
  label: string;
  distanceM: number;
  activeDurationSeconds: number;
  sprintCount: number;
  topSpeedKmh: number | null;
  zones: ZoneSeconds;
};

export type SummarySprintView = {
  rank: number;
  distanceM: number;
  durationS: number;
  peakSpeedKmh: number;
};

export type SummaryMetricsView = {
  dataQuality: DataQuality;
  speedSource: SpeedSource;
  activeDurationSeconds: number;
  distanceM: number;
  topSpeedKmh: number | null;
  sprintCount: number;
  caloriesKcal: number | null;
  gapSeconds: number;
  acceptedFixCount: number;
  boundaries: SpeedBandBoundaries;
  bucket: SpeedBandBucket;
  pitchLongAxisM: number | null;
  zones: ZoneSeconds;
};

/** What the summary screen renders, whichever source it came from. */
export type SessionDetailModel = {
  id: string;
  source: 'local' | 'server';
  sessionType: SessionType;
  playStructure: PlayStructure;
  startedAt: string;
  pitchName: string | null;
  /** Stored override; null means the derived title. */
  storedTitle: string | null;
  syncStatus: SyncStatus;
  segmentCount: number;
  metrics: SummaryMetricsView | null;
  segments: SummarySegmentView[];
  sprints: SummarySprintView[];
};

const isBucket = (value: string): value is SpeedBandBucket =>
  value === 'futsal' || value === 'small' || value === 'mid' || value === 'full';

const toBucket = (value: string): SpeedBandBucket => (isBucket(value) ? value : 'full');

const zonesOf = (row: {
  zone_walk_seconds: number;
  zone_jog_seconds: number;
  zone_run_seconds: number;
  zone_high_run_seconds: number;
  zone_sprint_seconds: number;
}): ZoneSeconds => ({
  walk: row.zone_walk_seconds,
  jog: row.zone_jog_seconds,
  run: row.zone_run_seconds,
  high_run: row.zone_high_run_seconds,
  sprint: row.zone_sprint_seconds,
});

const rankSprints = (
  sprints: { distance_m: number; duration_s: number; peak_speed_kmh: number }[],
) =>
  sprints.map((sprint, index) => ({
    rank: index + 1,
    distanceM: sprint.distance_m,
    durationS: sprint.duration_s,
    peakSpeedKmh: sprint.peak_speed_kmh,
  }));

/** Local record for this user, any sync state. Null when this phone has no copy. */
export const loadLocalSessionDetail = async ({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<SessionDetailModel | null> => {
  const session = await getTrackingSession(sessionId);
  if (!session?.ended_at || (session.user_id != null && session.user_id !== userId)) return null;
  const metrics = await getStoredSessionMetrics(sessionId);
  const segments = await getSegmentsForSession(sessionId);
  const segmentMetrics = metrics ? await getStoredSegmentMetrics(sessionId) : [];
  const sprints = metrics ? await getStoredSprintEfforts(sessionId) : [];
  const metricsBySegment = new Map(segmentMetrics.map((row) => [row.segment_id, row]));

  return {
    id: session.id,
    source: 'local',
    sessionType: session.session_type,
    playStructure: normalizePlayStructure(session.play_structure),
    startedAt: session.started_at,
    pitchName: session.pitch_name,
    storedTitle: session.title,
    syncStatus: session.sync_status,
    segmentCount: segments.length,
    metrics: metrics
      ? {
          dataQuality: metrics.data_quality,
          speedSource: metrics.speed_source,
          activeDurationSeconds: metrics.active_duration_seconds,
          distanceM: metrics.distance_m,
          topSpeedKmh: metrics.top_speed_kmh,
          sprintCount: metrics.sprint_count,
          caloriesKcal: metrics.calories_kcal,
          gapSeconds: metrics.gap_seconds,
          acceptedFixCount: metrics.accepted_fix_count,
          boundaries: parseBandBoundaries(metrics.speed_band_boundaries_json),
          bucket: toBucket(metrics.speed_band_bucket),
          pitchLongAxisM: metrics.pitch_long_axis_m,
          zones: zonesOf(metrics),
        }
      : null,
    segments: segments.flatMap((segment) => {
      const row = metricsBySegment.get(segment.id);
      if (!row) return [];
      return [
        {
          label: segmentLabelFor({ session, segment, allSegments: segments }),
          distanceM: row.distance_m,
          activeDurationSeconds: row.active_duration_seconds,
          sprintCount: row.sprint_count,
          topSpeedKmh: row.top_speed_kmh,
          zones: zonesOf(row),
        },
      ];
    }),
    sprints: rankSprints(sprints),
  };
};

/** A server-sourced session is synced by definition. */
export const fromServerDetail = (detail: SessionDetail): SessionDetailModel => {
  const playStructure = normalizePlayStructure(detail.play_structure);
  const session = { session_type: detail.session_type, play_structure: playStructure };
  const metricsByIndex = new Map(detail.segment_metrics.map((row) => [row.segment_index, row]));
  const { metrics } = detail;

  return {
    id: detail.id,
    source: 'server',
    sessionType: detail.session_type,
    playStructure,
    startedAt: detail.started_at,
    pitchName: detail.pitch?.name ?? null,
    storedTitle: detail.title,
    syncStatus: 'synced',
    segmentCount: detail.segments.length,
    metrics: metrics
      ? {
          dataQuality: metrics.data_quality,
          speedSource: metrics.speed_source,
          activeDurationSeconds: metrics.active_duration_seconds,
          distanceM: metrics.distance_m,
          topSpeedKmh: metrics.top_speed_kmh,
          sprintCount: metrics.sprint_count,
          caloriesKcal: metrics.calories_kcal,
          gapSeconds: metrics.gap_seconds,
          acceptedFixCount: metrics.accepted_fix_count,
          boundaries: metrics.speed_band_boundaries_kmh,
          bucket: toBucket(metrics.speed_band_bucket),
          pitchLongAxisM: metrics.pitch_long_axis_m,
          zones: zonesOf(metrics),
        }
      : null,
    segments: [...detail.segments]
      .sort((a, b) => a.segment_index - b.segment_index)
      .flatMap((segment) => {
        const row = metricsByIndex.get(segment.segment_index);
        if (!row) return [];
        return [
          {
            label: segmentLabelFor({ session, segment, allSegments: detail.segments }),
            distanceM: row.distance_m,
            activeDurationSeconds: row.active_duration_seconds,
            sprintCount: row.sprint_count,
            topSpeedKmh: row.top_speed_kmh,
            zones: zonesOf(row),
          },
        ];
      }),
    sprints: rankSprints(
      [...detail.sprint_efforts].sort(
        (a, b) => b.distance_m - a.distance_m || a.effort_index - b.effort_index,
      ),
    ),
  };
};
