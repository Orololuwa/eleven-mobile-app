import * as Location from 'expo-location';
import type { AttackDirection, SessionStartOut } from '../types';
import { resolveAttackDirection, cornersFromSessionRow } from './attack-direction';
import {
  closeOpenPause,
  closeSegment,
  getActiveTrackingSession,
  getCurrentSegment,
  getPausesForSegment,
  getPointsForSegment,
  getPointsForSession,
  getSegmentsForSession,
  getTrackingSession,
  insertSegment,
  seedTrackingSession,
  updateSessionFields,
} from './db';
import { startLocationTracking, stopLocationTracking } from './location-task';
import {
  startTrackingIndicator,
  stopTrackingIndicator,
  updateTrackingIndicator,
} from './indicator';
import { computeLiveMetrics } from './live-metrics';
import { requestTrackingPermissions } from './permissions';
import { enqueueSessionSync } from './sync';
import type { BackgroundPermission, StoredPitchCorners } from './types';

export const bootstrapTrackingSession = async ({
  startOut,
  pitchName,
  pitchCorners,
}: {
  startOut: SessionStartOut;
  pitchName: string | null;
  pitchCorners: StoredPitchCorners | null;
}) => {
  await seedTrackingSession({ startOut, pitchName, pitchCorners });
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
  await updateSessionFields(session.id, { segment_clock_origin_ms: Date.now() });

  await startLocationTracking({ notificationBody: 'Starting session…' });

  const activityId = await startTrackingIndicator({
    session,
    segment,
    snapshot: { elapsedSeconds: 0, distanceKm: 0, topSpeedKmh: 0 },
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

export const computeSegmentElapsedSeconds = async (sessionId: string, segmentId: string | null) => {
  const session = await getTrackingSession(sessionId);
  if (!session) return 0;

  const segments = await getSegmentsForSession(sessionId);
  const segment = segmentId ? segments.find((s) => s.id === segmentId) : null;
  const segmentStart = segment?.started_at ?? session.started_at;

  const pauses = segmentId
    ? await getPausesForSegment(segmentId)
    : (await import('./db').then((m) => m.getPausesForSession(sessionId))).filter(
        (p) => p.segment_id == null,
      );

  const startMs = new Date(segmentStart).getTime();
  const nowMs = Date.now();

  const pausedMs = pauses.reduce((sum, pause) => {
    const pauseStart = new Date(pause.started_at).getTime();
    const pauseEnd = pause.ended_at ? new Date(pause.ended_at).getTime() : nowMs;
    return sum + Math.max(0, pauseEnd - pauseStart);
  }, 0);

  return Math.max(0, Math.floor((nowMs - startMs - pausedMs) / 1000));
};

export const refreshIndicatorIfNeeded = async ({
  sessionId,
  distanceUnit,
  force = false,
  tickMs,
}: {
  sessionId: string;
  distanceUnit: 'km' | 'mi';
  force?: boolean;
  tickMs: number;
}) => {
  const session = await getTrackingSession(sessionId);
  if (!session || session.ended_at) return null;

  const segment = await getCurrentSegment(sessionId);
  const segmentId = segment?.id ?? null;
  const points = segmentId
    ? await getPointsForSegment(segmentId)
    : await getPointsForSession(sessionId);

  const pauses = segmentId
    ? await getPausesForSegment(segmentId)
    : (await import('./db').then((m) => m.getPausesForSession(sessionId))).filter(
        (p) => p.segment_id == null,
      );

  const metrics = computeLiveMetrics({ points, pausedRanges: pauses });
  const elapsedSeconds = await computeSegmentElapsedSeconds(sessionId, segmentId);

  const shouldUpdate = force || tickMs % 5000 < 1000;

  if (shouldUpdate) {
    await updateTrackingIndicator({
      liveActivityId: session.live_activity_id,
      session,
      segment,
      snapshot: {
        elapsedSeconds,
        distanceKm: metrics.distanceKm,
        topSpeedKmh: metrics.topSpeedKmh,
      },
      distanceUnit,
    });
  }

  return { elapsedSeconds, metrics, segment, session };
};

export const closeCurrentSegmentForSwitch = async (sessionId: string) => {
  const session = await getTrackingSession(sessionId);
  if (!session) return null;

  await closeOpenPause(sessionId);
  const current = await getCurrentSegment(sessionId);
  if (current) {
    await closeSegment(current.id);
  }

  const corners = cornersFromSessionRow(session);
  if (!corners || !session.pitch_id) {
    const allSegments = await getSegmentsForSession(sessionId);
    const nextIndex = allSegments.length + 1;
    const newSegmentId = await insertSegment({
      sessionId,
      segmentIndex: nextIndex,
      attackDirection: null,
    });
    await updateSessionFields(sessionId, {
      current_segment_id: newSegmentId,
      segment_clock_origin_ms: Date.now(),
    });
    return { skippedCompass: true as const };
  }

  return { skippedCompass: false as const, corners };
};

export const completeSegmentSwitch = async ({
  sessionId,
  attackDirection,
  distanceUnit,
}: {
  sessionId: string;
  attackDirection: AttackDirection | null;
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
  });

  await updateSessionFields(sessionId, {
    current_segment_id: newSegmentId,
    segment_clock_origin_ms: Date.now(),
  });

  const updatedSession = await getTrackingSession(sessionId);
  const segment = await getCurrentSegment(sessionId);
  if (updatedSession) {
    await updateTrackingIndicator({
      liveActivityId: updatedSession.live_activity_id,
      session: updatedSession,
      segment,
      snapshot: { elapsedSeconds: 0, distanceKm: 0, topSpeedKmh: 0 },
      distanceUnit,
    });
  }
};

export const resolveCompassAttackDirection = async (
  sessionId: string,
): Promise<AttackDirection | null> => {
  const session = await getTrackingSession(sessionId);
  if (!session) return null;

  const corners = cornersFromSessionRow(session);
  if (!corners) return null;

  const [heading, location] = await Promise.all([
    Location.getHeadingAsync(),
    Location.getCurrentPositionAsync({}),
  ]);

  const headingDegrees = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;

  return resolveAttackDirection({
    headingDegrees,
    corners,
    position: { lat: location.coords.latitude, lng: location.coords.longitude },
  });
};

export const endTrackingSession = async (sessionId: string) => {
  const session = await getTrackingSession(sessionId);
  if (!session) return;

  await closeOpenPause(sessionId);
  const current = await getCurrentSegment(sessionId);
  if (current && !current.ended_at) {
    await closeSegment(current.id);
  }

  await updateSessionFields(sessionId, {
    ended_at: new Date().toISOString(),
    tracking_status: 'ended',
  });

  await stopTrackingIndicator(session.live_activity_id);
  await stopLocationTracking();

  enqueueSessionSync(sessionId);
};
