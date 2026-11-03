import { AppState } from 'react-native';
import { toComputationInput } from '../summary/computation-input';
import { getStrideEstimate } from '../summary/stride-store';
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
  getPointsForSessionAfter,
  getSegmentsForSession,
  getTrackingSession,
  upsertLiveSnapshot,
} from './db';
import { getLatestFix } from './latest-fix';
import { readoutFromBasis } from './live-metrics';
import {
  createLiveTracker,
  feedLiveTracker,
  liveTrackerBasis,
  type LiveTracker,
} from './live-tracker';
import {
  isLiveSnapshotStale,
  liveClockFromRows,
  newestFix,
  type LiveSnapshot,
} from './live-snapshot-model';
import type {
  TrackingPauseRow,
  TrackingPointRow,
  TrackingSegmentRow,
  TrackingSessionRow,
} from './types';

export type { LiveSnapshot };

const persistedFix = (session: TrackingSessionRow) =>
  session.last_fix_at_ms != null
    ? { atMs: session.last_fix_at_ms, accuracyM: session.last_fix_accuracy_m }
    : null;

/** This JS context's open forward pass. Rebuilt on a new session or after a JS restart. */
let tracker: LiveTracker | null = null;

/** Slower than this, a refresh is logged — it holds the DB queue the location task writes through. */
const SLOW_REFRESH_MS = 250;

const feedRows = ({
  target,
  rows,
  input,
}: {
  target: LiveTracker;
  rows: TrackingPointRow[];
  input: ReturnType<typeof toComputationInput>;
}) => {
  const segmentIds = new Set(input.segments.map((segment) => segment.id));
  return input.points.every((point, index) =>
    feedLiveTracker({
      tracker: target,
      point,
      sequenceIndex: rows[index]!.sequence_index,
      segmentIds,
      pauses: input.pauses,
    }),
  );
};

/**
 * Bring the tracker up to date: feed only the points stored since the last refresh. A fresh
 * tracker (new session, JS restart) or a fix out of time order replays the whole trace once.
 */
const syncTracker = async ({
  session,
  segments,
  pauses,
  nowIso,
}: {
  session: TrackingSessionRow;
  segments: TrackingSegmentRow[];
  pauses: TrackingPauseRow[];
  nowIso: string;
}): Promise<{ tracker: LiveTracker; fed: number; rebuilt: boolean }> => {
  const inputFor = (rows: TrackingPointRow[]) =>
    toComputationInput({ session, segments, pauses, points: rows, openEndsAt: nowIso });

  const current = tracker;
  if (current?.sessionId === session.id) {
    const read = await getPointsForSessionAfter(session.id, current.lastSequenceIndex);
    // Another refresh may have fed some of these while this read waited on the DB queue.
    const rows = read.filter((row) => row.sequence_index > current.lastSequenceIndex);
    if (feedRows({ target: current, rows, input: inputFor(rows) })) {
      return { tracker: current, fed: rows.length, rebuilt: false };
    }
    console.warn('[live-snapshot] fix out of time order — replaying the trace', {
      sessionId: session.id,
    });
  }

  const rows = await getPointsForSession(session.id);
  const input = inputFor(rows);
  const fresh = createLiveTracker({
    sessionId: session.id,
    corners: input.corners,
    stride: await getStrideEstimate(session.user_id ?? null),
  });
  feedRows({ target: fresh, rows, input });
  tracker = fresh;
  return { tracker: fresh, fed: rows.length, rebuilt: true };
};

/** Live state of the session now. Callers go through `refreshLiveSnapshot`. */
export const computeLiveSnapshot = async (
  sessionId: string,
  nowMs = Date.now(),
): Promise<LiveSnapshot | null> => {
  const startedMs = Date.now();
  const [session, segments, pauses] = await Promise.all([
    getTrackingSession(sessionId),
    getSegmentsForSession(sessionId),
    getPausesForSession(sessionId),
  ]);
  if (!session || session.ended_at || session.tracking_status === 'ended') {
    if (tracker?.sessionId === sessionId) tracker = null;
    return null;
  }

  const segment =
    segments.filter((row) => !row.ended_at).sort((a, b) => b.segment_index - a.segment_index)[0] ??
    null;
  const latestFix = newestFix(getLatestFix(), persistedFix(session));
  const nowIso = new Date(nowMs).toISOString();
  const synced = await syncTracker({ session, segments, pauses, nowIso });
  const metrics = readoutFromBasis({
    basis: liveTrackerBasis({
      tracker: synced.tracker,
      input: toComputationInput({ session, segments, pauses, points: [], openEndsAt: nowIso }),
      segmentId: segment?.id ?? null,
    }),
    nowMs,
    latestFix,
  });
  const tookMs = Date.now() - startedMs;
  if (tookMs > SLOW_REFRESH_MS) {
    console.warn('[live-snapshot] slow refresh', {
      tookMs,
      fed: synced.fed,
      rebuilt: synced.rebuilt,
      lastSequenceIndex: synced.tracker.lastSequenceIndex,
    });
  }
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
