import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useAppStore } from '@/stores/app-store';
import type { ActivityKind, AttackDirection } from '../types';
import { normalizePlayStructure, segmentLabelFor } from '../segment-display';
import { getCurrentSegment, getSegmentsForSession, getTrackingSession, initTrackingDb } from './db';
import {
  getLatestFix,
  handleAppBackgrounded,
  handleAppForegrounded,
  handleAppStateForRegistration,
  isLocationTaskRunning,
  resumeManualPause,
  startManualPause,
} from './location-task';
import {
  closeCurrentSegmentForSwitch,
  completeSegmentSwitch,
  endCurrentActivity,
  endTrackingSession,
  refreshIndicatorIfNeeded,
  requestAndBeginTracking,
  resolveCompassAttackDirection,
} from './session-lifecycle';
import { startSyncListeners } from './sync';
import { useTrackingHudStore } from './tracking-store';
import type { TrackingSessionRow } from './types';
import { gpsStrengthBars } from './live-metrics';
import { readFreshLiveSnapshot, readLiveSnapshot } from './live-snapshot';
import { hudPatchFromSnapshot, type LiveSnapshot } from './live-snapshot-model';

export const useTrackingSession = ({
  sessionId,
  massKg = null,
}: {
  sessionId: string;
  massKg?: number | null;
}) => {
  const units = useAppStore((s) => s.units);
  const distanceUnit = units.distance === 'mi' ? 'mi' : 'km';
  const phase = useTrackingHudStore((s) => s.phase);
  const setPhase = useTrackingHudStore((s) => s.setPhase);
  const setHud = useTrackingHudStore((s) => s.setHud);
  const resetHud = useTrackingHudStore((s) => s.reset);

  const [session, setSession] = useState<TrackingSessionRow | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingActivityKind, setPendingActivityKind] = useState<ActivityKind | null>(null);
  /** Latest snapshot from the location task; the 1 s clock repaints from it with no I/O. */
  const snapshotRef = useRef<LiveSnapshot | null>(null);

  const paintSnapshot = useCallback(
    (snapshot: LiveSnapshot) => {
      snapshotRef.current = snapshot;
      setHud(hudPatchFromSnapshot({ snapshot, memoryFix: getLatestFix() }));
    },
    [setHud],
  );

  /** After a lifecycle write (which forces a snapshot), drop the held anchors at once. */
  const repaintFromStore = useCallback(async () => {
    const snapshot = await readLiveSnapshot(sessionId);
    if (snapshot) paintSnapshot(snapshot);
  }, [paintSnapshot, sessionId]);

  const loadSession = useCallback(async () => {
    await initTrackingDb();
    const row = await getTrackingSession(sessionId);
    setSession(row);
    if (row) {
      // Paint the persisted snapshot first so a remount (unlock, kill, freeze) shows the real clock
      // and numbers immediately instead of 0:00 until the next pass.
      const snapshot = await readLiveSnapshot(sessionId);
      if (snapshot) {
        paintSnapshot(snapshot);
      } else {
        const segment = await getCurrentSegment(sessionId);
        const allSegments = await getSegmentsForSession(sessionId);
        setHud({
          activityKind: segment?.activity_kind ?? null,
          segmentIndex: segment?.segment_index ?? 1,
          segmentLabel: segmentLabelFor({ session: row, segment, allSegments }),
        });
      }
    }
    return row;
  }, [paintSnapshot, sessionId, setHud]);

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
              const result = await requestAndBeginTracking(distanceUnit, {
                requestBackground: false,
              });
              if (!result.ok) {
                setPhase('permission');
                setReady(true);
                return;
              }
            } catch (error) {
              console.warn('[tracking] failed to resume location updates', error);
              setPhase('permission');
              setReady(true);
              return;
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
  }, [distanceUnit, loadSession, resetHud, setPhase]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'inactive' || state === 'background') {
        void handleAppStateForRegistration().catch((error) => {
          console.warn('[tracking] app-state registration ensure failed', error);
        });
      }
      if (state === 'background') {
        void handleAppBackgrounded();
      } else if (state === 'active') {
        void handleAppForegrounded();
      }
    });
    return () => sub.remove();
  }, []);

  const sessionLive = session != null && session.tracking_status !== 'ended';

  useEffect(() => {
    if (!ready || !sessionLive) return;
    let cancelled = false;
    let reading = false;

    const tick = async () => {
      // Clock first, from the anchors we already hold — never blocked behind SQLite.
      const held = snapshotRef.current;
      if (held) setHud(hudPatchFromSnapshot({ snapshot: held, memoryFix: getLatestFix() }));
      if (reading) return;
      reading = true;
      try {
        const row = await getTrackingSession(sessionId);
        if (cancelled || !row) return;
        setSession(row);
        if (row.tracking_status === 'ended') return;

        // The location task writes this after each delivery; the HUD only recomputes when it has
        // gone quiet (no fixes / process was frozen) so `offline` still shows.
        const snapshot = await readFreshLiveSnapshot(sessionId);
        if (cancelled || !snapshot) return;
        paintSnapshot(snapshot);

        if (row.tracking_status === 'live') {
          await refreshIndicatorIfNeeded({ distanceUnit });
        }
      } finally {
        reading = false;
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready, sessionLive, sessionId, distanceUnit, paintSnapshot, setHud]);

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
    await repaintFromStore();
  };

  const resume = async () => {
    await resumeManualPause(sessionId);
    const row = await loadSession();
    setSession(row);
    await repaintFromStore();
  };

  const stopCurrentActivity = async () => {
    const segment = await getCurrentSegment(sessionId);
    const hud = useTrackingHudStore.getState();
    const row = await getTrackingSession(sessionId);
    const allSegments = await getSegmentsForSession(sessionId);
    const closedLabel = row ? segmentLabelFor({ session: row, segment, allSegments }) : '';

    setHud({
      closedSegmentElapsed: hud.elapsedSeconds,
      closedSegmentDistanceKm: hud.metrics.distanceKm,
      closedSegmentIndex: segment?.segment_index ?? hud.segmentIndex,
      closedSegmentLabel: closedLabel,
      activityKind: null,
      elapsedSeconds: 0,
    });

    await endCurrentActivity(sessionId);
    await repaintFromStore();
    await refreshIndicatorIfNeeded({ distanceUnit, force: true });
    await loadSession();
  };

  const beginSegmentSwitch = async ({
    activityKind = null,
  }: { activityKind?: ActivityKind | null } = {}) => {
    const row = await getTrackingSession(sessionId);
    if (!row) return;

    const segment = await getCurrentSegment(sessionId);
    const hud = useTrackingHudStore.getState();

    setHud({
      closedSegmentElapsed: hud.elapsedSeconds,
      closedSegmentDistanceKm: hud.metrics.distanceKm,
      closedSegmentIndex: segment?.segment_index ?? hud.segmentIndex,
    });
    setPendingActivityKind(activityKind);

    const result = await closeCurrentSegmentForSwitch({ sessionId, activityKind });
    if (!result) return;

    if (result.skippedCompass) {
      setPendingActivityKind(null);
      setPhase('tracking');
      await repaintFromStore();
      await loadSession();
      return;
    }

    // Show the switch UI immediately; compass resolve is capped so it cannot freeze the hold path.
    setPhase('segment-switch');
    const direction = await resolveCompassAttackDirection(sessionId);
    setHud({ pendingAttackDirection: direction });
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
    await repaintFromStore();
    await loadSession();
  };

  const flipPendingDirection = () => {
    const current = useTrackingHudStore.getState().pendingAttackDirection;
    if (!current) return;
    setHud({ pendingAttackDirection: current === 'end_a' ? 'end_b' : 'end_a' });
  };

  const endSession = async (onStopped?: () => void) => {
    // Do not loadSession after end — that re-renders the live HUD with status "ended" and races
    // the summary replace (view flicker). Navigate on stop; metrics finish in the background.
    await endTrackingSession({ sessionId, massKg, onStopped });
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
