import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Button } from '@/components';
import { SessionSummaryScreen, type SummarySegmentView } from '@/screens/session/session-summary';
import { segmentLabelFor, normalizePlayStructure } from '@/features/sessions/segment-display';
import { formatSummaryDate, sizeLabel } from '@/features/sessions/summary/display';
import {
  parseBandBoundaries,
  getStoredSegmentMetrics,
  getStoredSessionMetrics,
  getStoredSprintEfforts,
} from '@/features/sessions/summary/metrics-store';
import {
  getSegmentsForSession,
  getTrackingSession,
  initTrackingDb,
} from '@/features/sessions/tracking/db';
import type { SyncStatus } from '@/features/sessions/tracking/types';
import type { SpeedBandBucket } from '@/features/sessions/summary/speed-bands';
import { useAppStore } from '@/stores/app-store';
import { useColors } from '@/theme';

const laidBricks = new Set<string>();

const isBucket = (value: string): value is SpeedBandBucket =>
  value === 'futsal' || value === 'small' || value === 'mid' || value === 'full';

const TITLE: Record<string, string> = {
  match: 'MATCH',
  training: 'TRAINING',
  futsal: 'FUTSAL',
};

export default function SessionSummaryRoute() {
  const navigation = useNavigation();
  const colors = useColors();
  const { sessionId = '' } = useLocalSearchParams<{ sessionId?: string }>();
  const units = useAppStore((state) => state.units);
  const sessionCount = useAppStore((state) => state.sessionCount);
  const incrementSessionCount = useAppStore((state) => state.incrementSessionCount);
  const distanceUnit = units.distance === 'mi' ? 'mi' : 'km';
  const [showWhy, setShowWhy] = useState(false);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('pending');
  const [model, setModel] = useState<Awaited<ReturnType<typeof loadSummary>>>(null);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false, headerShown: false });
  }, [navigation]);

  useEffect(() => {
    if (!sessionId || laidBricks.has(sessionId)) return;
    laidBricks.add(sessionId);
    incrementSessionCount();
  }, [incrementSessionCount, sessionId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await initTrackingDb();
      const next = await loadSummary(sessionId);
      if (cancelled) return;
      setModel(next);
      setSyncStatus(next?.syncStatus ?? 'pending');
      setReady(true);
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [sessionId]);

  if (!ready) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.background.secondary, justifyContent: 'center' }}
      >
        <ActivityIndicator color={colors.brand.ink} />
      </View>
    );
  }

  if (!model) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background.secondary,
          justifyContent: 'center',
          padding: 24,
          gap: 16,
        }}
      >
        <Text style={{ color: colors.text.primary, fontSize: 18 }}>
          This session's numbers aren't on the phone.
        </Text>
        <Button title="Done" onPress={() => router.replace('/(app)/(tabs)')} />
      </View>
    );
  }

  const brickNumber = sessionId && laidBricks.has(sessionId) ? sessionCount : sessionCount + 1;

  const playStructure = normalizePlayStructure(model.playStructure);
  const contextLabel =
    playStructure === 'training_activities'
      ? model.segments.length === 1
        ? '1 ACTIVITY'
        : `${model.segments.length} ACTIVITIES`
      : sizeLabel(model.bucket);

  return (
    <SessionSummaryScreen
      title={TITLE[model.sessionType] ?? 'SESSION'}
      dateLabel={formatSummaryDate(model.startedAt)}
      placeLabel={model.pitchName?.toUpperCase() ?? 'NO PITCH'}
      contextLabel={contextLabel}
      brickNumber={brickNumber}
      syncStatus={syncStatus}
      distanceUnit={distanceUnit}
      dataQuality={model.dataQuality}
      speedSource={model.speedSource}
      activeDurationSeconds={model.activeDurationSeconds}
      distanceM={model.distanceM}
      topSpeedKmh={model.topSpeedKmh}
      sprintCount={model.sprintCount}
      caloriesKcal={model.caloriesKcal}
      gapSeconds={model.gapSeconds}
      acceptedFixCount={model.acceptedFixCount}
      boundaries={model.boundaries}
      bucket={model.bucket}
      pitchLongAxisM={model.pitchLongAxisM}
      zones={{
        walk: model.zoneWalk,
        jog: model.zoneJog,
        run: model.zoneRun,
        high_run: model.zoneHighRun,
        sprint: model.zoneSprint,
      }}
      segmentHeading={
        playStructure === 'halves' ? 'BY HALF' : playStructure === 'sets' ? 'BY SET' : 'BY ACTIVITY'
      }
      segments={model.segments}
      sprints={model.sprints}
      showRejectedWhy={showWhy}
      onOpenRejectedWhy={() => setShowWhy(true)}
      onCloseRejectedWhy={() => setShowWhy(false)}
      onDone={() => router.replace('/(app)/(tabs)')}
    />
  );
}

const loadSummary = async (sessionId: string) => {
  if (!sessionId) return null;
  const session = await getTrackingSession(sessionId);
  const metrics = await getStoredSessionMetrics(sessionId);
  if (!session || !metrics) return null;
  const [segments, segmentMetrics, sprints] = await Promise.all([
    getSegmentsForSession(sessionId),
    getStoredSegmentMetrics(sessionId),
    getStoredSprintEfforts(sessionId),
  ]);
  const metricsBySegment = new Map(segmentMetrics.map((row) => [row.segment_id, row]));
  const bucket = isBucket(metrics.speed_band_bucket) ? metrics.speed_band_bucket : 'full';
  const views: SummarySegmentView[] = segments.flatMap((segment) => {
    const row = metricsBySegment.get(segment.id);
    if (!row) return [];
    return [
      {
        label: segmentLabelFor({
          session,
          segment,
          allSegments: segments,
        }),
        distanceM: row.distance_m,
        activeDurationSeconds: row.active_duration_seconds,
        sprintCount: row.sprint_count,
        topSpeedKmh: row.top_speed_kmh,
        zones: {
          walk: row.zone_walk_seconds,
          jog: row.zone_jog_seconds,
          run: row.zone_run_seconds,
          high_run: row.zone_high_run_seconds,
          sprint: row.zone_sprint_seconds,
        },
      },
    ];
  });

  return {
    syncStatus: session.sync_status,
    sessionType: session.session_type,
    playStructure: session.play_structure,
    startedAt: session.started_at,
    pitchName: session.pitch_name,
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
    bucket,
    pitchLongAxisM: metrics.pitch_long_axis_m,
    zoneWalk: metrics.zone_walk_seconds,
    zoneJog: metrics.zone_jog_seconds,
    zoneRun: metrics.zone_run_seconds,
    zoneHighRun: metrics.zone_high_run_seconds,
    zoneSprint: metrics.zone_sprint_seconds,
    segments: views,
    sprints: sprints.map((sprint, index) => ({
      rank: index + 1,
      distanceM: sprint.distance_m,
      durationS: sprint.duration_s,
      peakSpeedKmh: sprint.peak_speed_kmh,
    })),
  };
};
