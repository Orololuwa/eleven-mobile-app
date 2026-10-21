import type { ActivityKind, AttackDirection } from '../types';
import { LIVE_SNAPSHOT_STALE_MS } from './constants';
import { currentFixAccuracyM } from './live-metrics';
import type { LatestFix, LiveMetrics, TrackingStatus } from './types';

/**
 * Everything the elapsed clock needs, as wall-clock anchors. The HUD ticks from this locally, so the
 * clock never waits on SQLite or the metrics pass — and a fresh mount paints the right time at once.
 */
export type LiveClock = {
  /** Segment (or session) start. Null when nothing is running (training rest) — reads 0. */
  startedAtMs: number | null;
  /** Sum of closed pauses after `startedAtMs`. */
  closedPausedMs: number;
  /** Open pause start — the clock holds here until the pause closes. */
  openPauseStartedAtMs: number | null;
};

/**
 * Live state computed by the location task (and by the HUD only when the task has gone quiet), then
 * persisted per session in `live_snapshots`. The HUD, the FGS notification and the Live Activity all
 * read this instead of each re-running the metrics pass.
 */
export type LiveSnapshot = {
  sessionId: string;
  segmentId: string | null;
  segmentIndex: number;
  segmentLabel: string;
  activityKind: ActivityKind | null;
  attackDirection: AttackDirection | null;
  trackingStatus: TrackingStatus;
  /** HUD clock: the open segment, or 0 in a training rest. */
  clock: LiveClock;
  /** Indicator clock in a rest state: session start minus segment-less pauses. */
  sessionClock: LiveClock;
  plannedSeconds: number | null;
  metrics: LiveMetrics;
  latestFix: LatestFix | null;
  gpsSearchStartedAtMs: number | null;
  computedAtMs: number;
};

const parseMs = (iso: string) => new Date(iso).getTime();

export const liveClockFromRows = ({
  startedAt,
  pauses,
}: {
  startedAt: string | null;
  pauses: { started_at: string; ended_at: string | null }[];
}): LiveClock => {
  if (!startedAt) return { startedAtMs: null, closedPausedMs: 0, openPauseStartedAtMs: null };
  let closedPausedMs = 0;
  let openPauseStartedAtMs: number | null = null;
  for (const pause of pauses) {
    const pauseStartMs = parseMs(pause.started_at);
    if (pause.ended_at) {
      closedPausedMs += Math.max(0, parseMs(pause.ended_at) - pauseStartMs);
    } else if (openPauseStartedAtMs == null || pauseStartMs < openPauseStartedAtMs) {
      openPauseStartedAtMs = pauseStartMs;
    }
  }
  return { startedAtMs: parseMs(startedAt), closedPausedMs, openPauseStartedAtMs };
};

/** Same result as `elapsedSecondsFromPauses`, from anchors instead of rows. */
export const elapsedSecondsAt = (clock: LiveClock, nowMs = Date.now()) => {
  if (clock.startedAtMs == null) return 0;
  const endMs = clock.openPauseStartedAtMs ?? nowMs;
  return Math.max(0, Math.floor((endMs - clock.startedAtMs - clock.closedPausedMs) / 1000));
};

/** Newer of two fixes — the in-memory feed wins unless the persisted one is newer. */
export const newestFix = (a: LatestFix | null, b: LatestFix | null): LatestFix | null => {
  if (!a) return b;
  if (!b) return a;
  return a.atMs >= b.atMs ? a : b;
};

/**
 * Older than this, the location task has stopped refreshing the snapshot (no fixes, or the process
 * was frozen) — the reader recomputes so `offline` and the clock anchors stay true.
 */
export const isLiveSnapshotStale = ({
  computedAtMs,
  nowMs = Date.now(),
  staleMs = LIVE_SNAPSHOT_STALE_MS,
}: {
  computedAtMs: number;
  nowMs?: number;
  staleMs?: number;
}) => nowMs - computedAtMs > staleMs;

/** HUD fields at `nowMs`. Only the clock and GPS-age move between snapshots. */
export const hudPatchFromSnapshot = ({
  snapshot,
  memoryFix = null,
  nowMs = Date.now(),
}: {
  snapshot: LiveSnapshot;
  /** This JS context's newest fix — may be a second fresher than the snapshot's. */
  memoryFix?: LatestFix | null;
  nowMs?: number;
}) => {
  const elapsedSeconds = elapsedSecondsAt(snapshot.clock, nowMs);
  const extraSeconds =
    snapshot.plannedSeconds != null && elapsedSeconds > snapshot.plannedSeconds
      ? elapsedSeconds - snapshot.plannedSeconds
      : 0;
  return {
    elapsedSeconds,
    extraSeconds,
    metrics: snapshot.metrics,
    gpsAccuracyM: currentFixAccuracyM({
      fix: newestFix(memoryFix, snapshot.latestFix),
      nowMs,
    }),
    segmentIndex: snapshot.segmentIndex,
    segmentLabel: snapshot.segmentLabel,
    activityKind: snapshot.activityKind,
    attackDirection: snapshot.attackDirection,
    gpsSearchSeconds: snapshot.gpsSearchStartedAtMs
      ? Math.max(0, Math.floor((nowMs - snapshot.gpsSearchStartedAtMs) / 1000))
      : 0,
  };
};
