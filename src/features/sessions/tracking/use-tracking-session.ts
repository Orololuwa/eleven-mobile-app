import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useAppStore } from '@/stores/app-store';
import type { ActivityKind, AttackDirection } from '../types';
import {
  normalizePlayStructure,
  plannedMinutesForSegment,
  segmentLabelFor,
} from '../segment-display';
import {
  getCurrentSegment,
  getPausesForSegment,
  getSegmentsForSession,
  getTrackingSession,
  initTrackingDb,
  getPointsForSegment,
  getPointsForSession,
} from './db';
import {
  handleAppBackgrounded,
  handleAppForegrounded,
  isLocationTaskRunning,
  resumeManualPause,
  startLocationTracking,
  startManualPause,
} from './location-task';
import {
  closeCurrentSegmentForSwitch,
  completeSegmentSwitch,
  computeSegmentElapsedSeconds,
  endCurrentActivity,
  endTrackingSession,
  refreshIndicatorIfNeeded,
  requestAndBeginTracking,
  resolveCompassAttackDirection,
} from './session-lifecycle';
import { startSyncListeners } from './sync';
import { useTrackingHudStore } from './tracking-store';
import type { TrackingSessionRow } from './types';
import { computeLiveMetrics, gpsStrengthBars } from './live-metrics';

export const useTrackingSession = ({ sessionId }: { sessionId: string }) => {
  const units = useAppStore((s) => s.units);
  const distanceUnit = units.distance === 'mi' ? 'mi' : 'km';
  const phase = useTrackingHudStore((s) => s.phase);
  const setPhase = useTrackingHudStore((s) => s.setPhase);
  const setHud = useTrackingHudStore((s) => s.setHud);
  const resetHud = useTrackingHudStore((s) => s.reset);

  const [session, setSession] = useState<TrackingSessionRow | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingActivityKind, setPendingActivityKind] = useState<ActivityKind | null>(null);

  const loadSession = useCallback(async () => {
    await initTrackingDb();
    const row = await getTrackingSession(sessionId);
    setSession(row);
    if (row) {
      const segment = await getCurrentSegment(sessionId);
      const allSegments = await getSegmentsForSession(sessionId);
      setHud({
        activityKind: segment?.activity_kind ?? null,
        segmentIndex: segment?.segment_index ?? 1,
        segmentLabel: segmentLabelFor({ session: row, segment, allSegments }),
      });
    }
    return row;
  }, [sessionId, setHud]);

  useEffect(() => {
    startSyncListeners();
    void loadSession().then((row) => {
      if (!row) return;
      if (row.tracking_status === 'ended') {
        setReady(true);
        return;
      }
      void (async () => {
        const running = await isLocationTaskRunning();
        if (Platform.OS === 'android') {
          if (!running) {
            try {
              await startLocationTracking({ notificationBody: 'Starting session…' });
            } catch (error) {
              console.warn('[tracking] failed to resume location updates', error);
            }
          }
          setPhase('tracking');
        } else if (!running) {
          setPhase('permission');
        } else {
          setPhase('tracking');
        }
        setReady(true);
      })();
    });

    return () => {
      resetHud();
    };
  }, [loadSession, resetHud, setPhase]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background') {
        void handleAppBackgrounded();
      } else if (state === 'active') {
        void handleAppForegrounded();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!ready || !session || session.tracking_status === 'ended') return;

    const tick = async () => {
      const row = await getTrackingSession(sessionId);
      if (!row) return;
      setSession(row);

      const segment = await getCurrentSegment(sessionId);
      const allSegments = await getSegmentsForSession(sessionId);
      const segmentId = segment?.id ?? null;
      const points = segmentId
        ? await getPointsForSegment(segmentId)
        : await getPointsForSession(sessionId);
      const pauses = segmentId ? await getPausesForSegment(segmentId) : [];
      const metrics = computeLiveMetrics({ points, pausedRanges: pauses });
      const elapsedSeconds = segmentId
        ? await computeSegmentElapsedSeconds(sessionId, segmentId)
        : 0;

      const plannedMinutes = plannedMinutesForSegment({ session: row, segment });
      const plannedSeconds = plannedMinutes ? plannedMinutes * 60 : null;
      const extraSeconds =
        plannedSeconds != null && elapsedSeconds > plannedSeconds
          ? elapsedSeconds - plannedSeconds
          : 0;

      const gpsSearchSeconds = row.gps_search_started_at
        ? Math.floor((Date.now() - new Date(row.gps_search_started_at).getTime()) / 1000)
        : 0;

      const segmentLabel = segmentLabelFor({
        session: row,
        segment,
        allSegments,
      });

      const latestAccuracy =
        points.length > 0
          ? points[points.length - 1].horizontal_accuracy_m
          : row.last_accepted_fix_at
            ? 10
            : null;

      setHud({
        elapsedSeconds,
        extraSeconds,
        metrics,
        gpsAccuracyM: latestAccuracy,
        segmentIndex: segment?.segment_index ?? 1,
        segmentLabel,
        activityKind: segment?.activity_kind ?? null,
        attackDirection: segment?.attack_direction ?? null,
        gpsSearchSeconds,
      });

      if (row.tracking_status === 'live') {
        await refreshIndicatorIfNeeded({ distanceUnit });
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [ready, session, sessionId, distanceUnit, setHud]);

  const grantPermissionAndStart = async (requestBackground = true) => {
    const result = await requestAndBeginTracking(distanceUnit, { requestBackground });
    if (!result.ok) return false;
    setPhase('tracking');
    const row = await loadSession();
    setSession(row);
    return true;
  };

  const pause = async () => {
    await startManualPause(sessionId);
    const row = await loadSession();
    setSession(row);
  };

  const resume = async () => {
    await resumeManualPause(sessionId);
    const row = await loadSession();
    setSession(row);
  };

  const stopCurrentActivity = async () => {
    const segment = await getCurrentSegment(sessionId);
    const segmentId = segment?.id ?? null;
    const points = segmentId ? await getPointsForSegment(segmentId) : [];
    const elapsed = await computeSegmentElapsedSeconds(sessionId, segmentId);
    const metrics = computeLiveMetrics({ points, pausedRanges: [] });
    const row = await getTrackingSession(sessionId);
    const allSegments = await getSegmentsForSession(sessionId);
    const closedLabel = row ? segmentLabelFor({ session: row, segment, allSegments }) : '';

    setHud({
      closedSegmentElapsed: elapsed,
      closedSegmentDistanceKm: metrics.distanceKm,
      closedSegmentIndex: segment?.segment_index ?? 1,
      closedSegmentLabel: closedLabel,
      activityKind: null,
      elapsedSeconds: 0,
    });

    await endCurrentActivity(sessionId);
    await refreshIndicatorIfNeeded({ distanceUnit, force: true });
    await loadSession();
  };

  const beginSegmentSwitch = async ({
    activityKind = null,
  }: { activityKind?: ActivityKind | null } = {}) => {
    const row = await getTrackingSession(sessionId);
    if (!row) return;

    const segment = await getCurrentSegment(sessionId);
    const segmentId = segment?.id ?? null;
    const points = segmentId ? await getPointsForSegment(segmentId) : [];
    const elapsed = await computeSegmentElapsedSeconds(sessionId, segmentId);
    const metrics = computeLiveMetrics({ points, pausedRanges: [] });

    setHud({
      closedSegmentElapsed: elapsed,
      closedSegmentDistanceKm: metrics.distanceKm,
      closedSegmentIndex: segment?.segment_index ?? 1,
    });
    setPendingActivityKind(activityKind);

    const result = await closeCurrentSegmentForSwitch({ sessionId, activityKind });
    if (!result) return;

    if (result.skippedCompass) {
      setPendingActivityKind(null);
      setPhase('tracking');
      await loadSession();
      return;
    }

    const direction = await resolveCompassAttackDirection(sessionId);
    setHud({ pendingAttackDirection: direction });
    setPhase('segment-switch');
  };

  const confirmSegmentSwitch = async (attackDirection: AttackDirection | null) => {
    await completeSegmentSwitch({
      sessionId,
      attackDirection,
      activityKind: pendingActivityKind,
      distanceUnit,
    });
    setPendingActivityKind(null);
    setPhase('tracking');
    await loadSession();
  };

  const flipPendingDirection = () => {
    const current = useTrackingHudStore.getState().pendingAttackDirection;
    if (!current) return;
    setHud({ pendingAttackDirection: current === 'end_a' ? 'end_b' : 'end_a' });
  };

  const endSession = async () => {
    await endTrackingSession(sessionId);
    const row = await loadSession();
    setSession(row);
  };

  const trackingStatus = session?.tracking_status ?? 'live';
  const gps = gpsStrengthBars(useTrackingHudStore.getState().gpsAccuracyM);
  const playStructure = session
    ? normalizePlayStructure(session.play_structure)
    : 'training_activities';

  return {
    ready,
    session,
    phase,
    trackingStatus,
    gps,
    distanceUnit,
    playStructure,
    pendingActivityKind,
    grantPermissionAndStart,
    pause,
    resume,
    stopCurrentActivity,
    beginSegmentSwitch,
    confirmSegmentSwitch,
    flipPendingDirection,
    endSession,
  };
};
