import * as Location from 'expo-location';
import type { ActivityKind, AttackDirection, SessionStartOut } from '../types';
import { normalizePlayStructure, shouldResolveAttackDirection } from '../segment-display';
import { resolveAttackDirection, cornersFromSessionRow } from './attack-direction';
import {
  closeOpenPause,
  closeSegment,
  deleteLiveSnapshot,
  getActiveTrackingSession,
  getCurrentSegment,
  getSegmentsForSession,
  getTrackingSession,
  insertSegment,
  seedTrackingSession,
  updateSessionFields,
} from './db';
import { startLocationTracking, stopLocationTracking } from './location-task';
import {
  refreshTrackingIndicator,
  startTrackingIndicator,
  stopTrackingIndicator,
  updateTrackingIndicator,
} from './indicator';
import { refreshLiveSnapshot } from './live-snapshot';
import { elapsedSecondsAt } from './live-snapshot-model';
import { promptBackgroundPowerIfNeeded } from './background-power';
import { requestTrackingPermissions } from './permissions';
import { invalidateHistory } from '../history/history-cache';
import { computeAndStoreSessionMetrics } from '../summary/run-computation';
import { enqueueSessionSync } from './sync';
import type { BackgroundPermission, StoredPitchCorners } from './types';

export const bootstrapTrackingSession = async ({
  startOut,
  pitchName,
  pitchCorners,
  extraTimeEnabled,
  plannedExtraTimeSegmentLengthMinutes,
  trainingActivityOptions,
  startingActivityKind,
}: {
  startOut: SessionStartOut;
  pitchName: string | null;
  pitchCorners: StoredPitchCorners | null;
  extraTimeEnabled?: boolean | null;
  plannedExtraTimeSegmentLengthMinutes?: number | null;
  trainingActivityOptions?: ActivityKind[];
  startingActivityKind?: ActivityKind | null;
}) => {
  await seedTrackingSession({
    startOut,
    pitchName,
    pitchCorners,
    extraTimeEnabled,
    plannedExtraTimeSegmentLengthMinutes,
    trainingActivityOptions,
    startingActivityKind,
  });
};

/**
 * Everything the user must answer before the session clock starts: location, notifications and,
 * on Android, the battery exemptions (which leave the app). Kickoff calls this before creating the
 * session so no time is counted while dialogs or Settings are open. iOS "Always" stays on the HUD's
 * permission screen.
 */
export const prepareTrackingForKickoff = async () => {
  const permissions = await requestTrackingPermissions({ requestBackground: false });
  if (!permissions.foregroundGranted) {
    return { ok: false as const, reason: 'foreground_denied' as const };
  }
  await promptBackgroundPowerIfNeeded();
  return { ok: true as const };
};

export const beginTrackingAfterPermission = async ({
  backgroundPermission,
  distanceUnit,
}: {
  backgroundPermission: BackgroundPermission;
  distanceUnit: 'km' | 'mi';
}) => {
  const session = await getActiveTrackingSession();
  if (!session) return;

  await updateSessionFields(session.id, { background_permission: backgroundPermission });

  const segment = await getCurrentSegment(session.id);

  await startLocationTracking({ notificationBody: 'Starting session…' });

  // This also runs when the HUD remounts after a kill / freeze — seed the indicator from the real
  // clock and numbers, never 0:00. Clock anchors come from SQLite (segment start, pauses).
  const live = await refreshLiveSnapshot({ sessionId: session.id, force: true });
  const activityId = await startTrackingIndicator({
    session,
    segment,
    snapshot: live
      ? {
          elapsedSeconds: elapsedSecondsAt(live.segmentId ? live.clock : live.sessionClock),
          distanceKm: live.metrics.distanceKm,
          topSpeedKmh: live.metrics.topSpeedKmh,
          signal: live.metrics.signal,
        }
      : { elapsedSeconds: 0, distanceKm: null, topSpeedKmh: null, signal: 'settling' },
    distanceUnit,
  });

  if (activityId) {
    await updateSessionFields(session.id, { live_activity_id: activityId });
  }
};

export const requestAndBeginTracking = async (
  distanceUnit: 'km' | 'mi',
  { requestBackground = true }: { requestBackground?: boolean } = {},
) => {
  const permissions = await requestTrackingPermissions({ requestBackground });
  if (!permissions.foregroundGranted) {
    return { ok: false as const, reason: 'foreground_denied' as const };
  }

  const backgroundPermission: BackgroundPermission =
    permissions.background === 'always' ? 'always' : 'when_in_use';

  await beginTrackingAfterPermission({ backgroundPermission, distanceUnit });
  return { ok: true as const, backgroundPermission };
};

export const refreshIndicatorIfNeeded = async ({
  distanceUnit,
  force = false,
}: {
  distanceUnit: 'km' | 'mi';
  force?: boolean;
}) => {
  await refreshTrackingIndicator({ distanceUnit, force });
};

export const endCurrentActivity = async (sessionId: string) => {
  const session = await getTrackingSession(sessionId);
  if (!session) return;

  const closedAt = new Date().toISOString();
  await closeOpenPause(sessionId, closedAt);
  const current = await getCurrentSegment(sessionId);
  if (current) {
    await closeSegment(current.id, closedAt);
  }

  await updateSessionFields(sessionId, {
    current_segment_id: null,
    segment_clock_origin_ms: Date.now(),
    tracking_status: 'live',
    gps_search_started_at: null,
  });
  await refreshLiveSnapshot({ sessionId, force: true });
};

export const closeCurrentSegmentForSwitch = async ({
  sessionId,
  activityKind = null,
}: {
  sessionId: string;
  activityKind?: ActivityKind | null;
}) => {
  const session = await getTrackingSession(sessionId);
  if (!session) return null;

  const closedAt = new Date().toISOString();
  await closeOpenPause(sessionId, closedAt);
  const current = await getCurrentSegment(sessionId);
  if (current) {
    await closeSegment(current.id, closedAt);
  }

  const allSegments = await getSegmentsForSession(sessionId);
  const nextIndex = allSegments.length + 1;
  const needsDirection = shouldResolveAttackDirection({
    sessionType: session.session_type,
    activityKind,
    pitchId: session.pitch_id,
  });
  const corners = cornersFromSessionRow(session);

  if (!needsDirection || !corners) {
    const newSegmentId = await insertSegment({
      sessionId,
      segmentIndex: nextIndex,
      attackDirection: null,
      activityKind,
    });
    await updateSessionFields(sessionId, {
      current_segment_id: newSegmentId,
      segment_clock_origin_ms: Date.now(),
    });
    await refreshLiveSnapshot({ sessionId, force: true });
    return { skippedCompass: true as const, nextIndex, activityKind };
  }

  return { skippedCompass: false as const, corners, nextIndex, activityKind };
};

export const completeSegmentSwitch = async ({
  sessionId,
  attackDirection,
  activityKind = null,
  distanceUnit,
}: {
  sessionId: string;
  attackDirection: AttackDirection | null;
  activityKind?: ActivityKind | null;
  distanceUnit: 'km' | 'mi';
}) => {
  const session = await getTrackingSession(sessionId);
  if (!session) return;

  const allSegments = await getSegmentsForSession(sessionId);
  const nextIndex = allSegments.length + 1;

  const newSegmentId = await insertSegment({
    sessionId,
    segmentIndex: nextIndex,
    attackDirection,
    activityKind,
  });

  await updateSessionFields(sessionId, {
    current_segment_id: newSegmentId,
    segment_clock_origin_ms: Date.now(),
  });
  await refreshLiveSnapshot({ sessionId, force: true });

  const updatedSession = await getTrackingSession(sessionId);
  const segment = await getCurrentSegment(sessionId);
  if (updatedSession) {
    await updateTrackingIndicator({
      liveActivityId: updatedSession.live_activity_id,
      session: updatedSession,
      segment,
      allSegments: await getSegmentsForSession(sessionId),
      snapshot: { elapsedSeconds: 0, distanceKm: null, topSpeedKmh: null, signal: 'settling' },
      distanceUnit,
    });
  }
};

const COMPASS_RESOLVE_TIMEOUT_MS = 2_500;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);

export const resolveCompassAttackDirection = async (
  sessionId: string,
): Promise<AttackDirection | null> => {
  const session = await getTrackingSession(sessionId);
  if (!session) return null;

  const corners = cornersFromSessionRow(session);
  if (!corners) return null;

  const settled = await withTimeout(
    Promise.all([Location.getHeadingAsync(), Location.getCurrentPositionAsync({})]),
    COMPASS_RESOLVE_TIMEOUT_MS,
  );
  if (!settled) {
    console.warn('[tracking] compass resolve timed out — direction left blank');
    return null;
  }

  const [heading, location] = settled;
  const headingDegrees = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;

  return resolveAttackDirection({
    headingDegrees,
    corners,
    position: { lat: location.coords.latitude, lng: location.coords.longitude },
  });
};

export const endTrackingSession = async ({
  sessionId,
  massKg,
  onStopped,
}: {
  sessionId: string;
  massKg: number | null;
  /** Called after location/indicator stop so the UI can navigate while metrics still compute. */
  onStopped?: () => void;
}) => {
  const session = await getTrackingSession(sessionId);
  if (!session) return;

  const closedAt = new Date().toISOString();
  await closeOpenPause(sessionId, closedAt);
  const current = await getCurrentSegment(sessionId);
  if (current && !current.ended_at) {
    await closeSegment(current.id, closedAt);
  }

  // Mark ended before stop so the HUD tick exits and getActiveTrackingSession goes null.
  // stop clears trackingDesired immediately so leftover watch/task fixes tear down (no skip flood).
  await updateSessionFields(sessionId, {
    ended_at: closedAt,
    tracking_status: 'ended',
  });

  await stopLocationTracking({ reason: 'ended' });
  await deleteLiveSnapshot(sessionId);
  try {
    await stopTrackingIndicator(session.live_activity_id);
  } catch (error) {
    console.warn('[tracking] indicator stop failed', error);
  }

  onStopped?.();

  await computeAndStoreSessionMetrics({ sessionId, massKg });
  invalidateHistory();
  enqueueSessionSync(sessionId);
};

export const sessionPlayStructure = (session: { play_structure: string }) =>
  normalizePlayStructure(
    session.play_structure as 'halves' | 'sets' | 'training_activities' | 'open',
  );
