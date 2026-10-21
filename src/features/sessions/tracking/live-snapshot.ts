import { AppState } from 'react-native';
import { toComputationInput } from '../summary/computation-input';
import { plannedMinutesForSegment, segmentLabelFor } from '../segment-display';
import {
  LIVE_SNAPSHOT_ACTIVE_INTERVAL_MS,
  LIVE_SNAPSHOT_BACKGROUND_INTERVAL_MS,
} from './constants';
import {
  getActiveTrackingSession,
  getLiveSnapshotPayload,
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getTrackingSession,
  upsertLiveSnapshot,
} from './db';
import { getLatestFix } from './latest-fix';
import { computeLiveReadout } from './live-metrics';
import {
  isLiveSnapshotStale,
  liveClockFromRows,
  newestFix,
  type LiveSnapshot,
} from './live-snapshot-model';
import type { TrackingSessionRow } from './types';

export type { LiveSnapshot };

const persistedFix = (session: TrackingSessionRow) =>
  session.last_fix_at_ms != null
    ? { atMs: session.last_fix_at_ms, accuracyM: session.last_fix_accuracy_m }
    : null;

/** Full live pass over the session so far. Heavy — callers go through `refreshLiveSnapshot`. */
export const computeLiveSnapshot = async (
  sessionId: string,
  nowMs = Date.now(),
): Promise<LiveSnapshot | null> => {
  const [session, segments, pauses, points] = await Promise.all([
    getTrackingSession(sessionId),
    getSegmentsForSession(sessionId),
    getPausesForSession(sessionId),
    getPointsForSession(sessionId),
  ]);
  if (!session || session.ended_at || session.tracking_status === 'ended') return null;

  const segment =
    segments.filter((row) => !row.ended_at).sort((a, b) => b.segment_index - a.segment_index)[0] ??
    null;
  const latestFix = newestFix(getLatestFix(), persistedFix(session));
  const nowIso = new Date(nowMs).toISOString();
  const metrics = computeLiveReadout({
    input: toComputationInput({
      session,
      segments,
      pauses,
      points,
      openEndsAt: nowIso,
      computedAt: nowIso,
    }),
    segmentId: segment?.id ?? null,
    latestFix,
  });
  const plannedMinutes = plannedMinutesForSegment({ session, segment });

  return {
    sessionId,
    segmentId: segment?.id ?? null,
    segmentIndex: segment?.segment_index ?? 1,
    segmentLabel: segmentLabelFor({ session, segment, allSegments: segments }),
    activityKind: segment?.activity_kind ?? null,
    attackDirection: segment?.attack_direction ?? null,
    trackingStatus: session.tracking_status,
    clock: liveClockFromRows({
      startedAt: segment?.started_at ?? null,
      pauses: segment ? pauses.filter((pause) => pause.segment_id === segment.id) : [],
    }),
    sessionClock: liveClockFromRows({
      startedAt: session.started_at,
      pauses: pauses.filter((pause) => pause.segment_id == null),
    }),
    plannedSeconds: plannedMinutes ? plannedMinutes * 60 : null,
    metrics,
    latestFix,
    gpsSearchStartedAtMs: session.gps_search_started_at
      ? new Date(session.gps_search_started_at).getTime()
      : null,
    computedAtMs: nowMs,
  };
};

export const readLiveSnapshot = async (sessionId: string): Promise<LiveSnapshot | null> => {
  const payload = await getLiveSnapshotPayload(sessionId);
  if (!payload) return null;
  try {
    return JSON.parse(payload) as LiveSnapshot;
  } catch {
    return null;
  }
};

let inFlight: Promise<LiveSnapshot | null> | null = null;
let lastComputedAtMs = 0;

const computeAndStore = async (sessionId?: string) => {
  const id = sessionId ?? (await getActiveTrackingSession())?.id;
  if (!id) return null;
  const snapshot = await computeLiveSnapshot(id);
  if (!snapshot) return null;
  await upsertLiveSnapshot({
    sessionId: id,
    computedAtMs: snapshot.computedAtMs,
    payload: JSON.stringify(snapshot),
  });
  lastComputedAtMs = snapshot.computedAtMs;
  return snapshot;
};

/**
 * Recompute and persist the live snapshot. The location task calls this after every delivery
 * (throttled: 1 s with the HUD up, 5 s backgrounded); lifecycle actions force it. Returns null when
 * throttled or when there is no live session.
 */
export const refreshLiveSnapshot = async ({
  sessionId,
  force = false,
}: { sessionId?: string; force?: boolean } = {}): Promise<LiveSnapshot | null> => {
  if (!force) {
    if (inFlight) return inFlight;
    const intervalMs =
      AppState.currentState === 'active'
        ? LIVE_SNAPSHOT_ACTIVE_INTERVAL_MS
        : LIVE_SNAPSHOT_BACKGROUND_INTERVAL_MS;
    if (Date.now() - lastComputedAtMs < intervalMs) return null;
  }
  // A forced refresh runs after any pass already in flight, so it sees the caller's write.
  const run = (inFlight ?? Promise.resolve(null))
    .catch(() => null)
    .then(() => computeAndStore(sessionId));
  inFlight = run;
  try {
    return await run;
  } finally {
    if (inFlight === run) inFlight = null;
  }
};

/** Persisted snapshot, recomputed first if the task has gone quiet. */
export const readFreshLiveSnapshot = async (sessionId: string) => {
  const snapshot = await readLiveSnapshot(sessionId);
  if (snapshot && !isLiveSnapshotStale({ computedAtMs: snapshot.computedAtMs })) return snapshot;
  return (await refreshLiveSnapshot({ sessionId, force: true })) ?? snapshot;
};
