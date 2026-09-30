import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { ApiError } from '@/lib/api-client';
import { finalizeSession, uploadTrackPoints } from '../session-api';
import {
  getStoredSegmentMetrics,
  getStoredSessionMetrics,
  getStoredSprintEfforts,
  toSegmentMetricsPayload,
  toSessionMetricsPayload,
  toSprintEffortPayload,
} from '../summary/metrics-store';
import { SYNC_RETRY_INITIAL_MS, SYNC_RETRY_MAX_MS, TRACK_POINTS_CHUNK_SIZE } from './constants';
import { downsampleTrackPoints } from './downsample';
import { withUniqueSequenceIndexes } from './sequence-index';
import {
  deletePointsForSession,
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getSessionsPendingSync,
  getTrackingSession,
  updateSessionFields,
} from './db';
import type { SessionFinalizeBody, TrackingSegmentRow, TrackPointUpload } from './types';

const retryDelays = new Map<string, number>();
const inFlight = new Set<string>();
let syncLoopStarted = false;
let appStateSubscription: { remove: () => void } | null = null;
let netInfoUnsubscribe: (() => void) | null = null;

const nextDelay = (sessionId: string) => {
  const current = retryDelays.get(sessionId) ?? SYNC_RETRY_INITIAL_MS;
  const next = Math.min(current * 2, SYNC_RETRY_MAX_MS);
  retryDelays.set(sessionId, next);
  return current;
};

const resetDelay = (sessionId: string) => {
  retryDelays.delete(sessionId);
};

const chunkPoints = (points: TrackPointUpload[]) => {
  const chunks: TrackPointUpload[][] = [];
  for (let i = 0; i < points.length; i += TRACK_POINTS_CHUNK_SIZE) {
    chunks.push(points.slice(i, i + TRACK_POINTS_CHUNK_SIZE));
  }
  return chunks;
};

const indexBySegmentId = (segments: TrackingSegmentRow[]) =>
  new Map(segments.map((segment) => [segment.id, segment.segment_index]));

const segmentIndexFor = (indexById: Map<string, number>, segmentId: string) =>
  indexById.get(segmentId);

const isTerminalClientError = (error: unknown) =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  error.status !== 401 &&
  error.status !== 408 &&
  error.status !== 429;

export const syncSession = async (sessionId: string): Promise<boolean> => {
  if (inFlight.has(sessionId)) return false;
  inFlight.add(sessionId);

  try {
    const session = await getTrackingSession(sessionId);
    if (!session?.ended_at) return false;
    if (session.sync_status === 'synced') return true;

    const net = await NetInfo.fetch();
    if (net.isConnected === false) return false;

    await updateSessionFields(sessionId, {
      sync_status: 'syncing',
      sync_attempts: session.sync_attempts + 1,
      last_sync_attempt_at: new Date().toISOString(),
    });

    const segments = await getSegmentsForSession(sessionId);
    const pauses = await getPausesForSession(sessionId);
    const allPoints = await getPointsForSession(sessionId);
    const downsampled = withUniqueSequenceIndexes(downsampleTrackPoints(allPoints));
    const segmentIndexes = indexBySegmentId(segments);
    const endedAt = session.ended_at;

    const metrics = await getStoredSessionMetrics(sessionId);
    const segmentMetrics = metrics ? await getStoredSegmentMetrics(sessionId) : [];
    const sprintEfforts = metrics ? await getStoredSprintEfforts(sessionId) : [];

    const finalizeBody: SessionFinalizeBody = {
      ended_at: endedAt,
      segments: segments.map((segment) => ({
        segment_index: segment.segment_index,
        attack_direction: segment.attack_direction,
        activity_kind: segment.activity_kind,
        started_at: segment.started_at,
        ended_at: segment.ended_at ?? endedAt,
      })),
      pauses: pauses.flatMap((pause) => {
        const segmentIndex = segmentIndexFor(segmentIndexes, pause.segment_id);
        if (segmentIndex == null) {
          console.warn('[sync] drop pause without segment', pause.id);
          return [];
        }
        return [
          {
            segment_index: segmentIndex,
            reason: pause.reason,
            started_at: pause.started_at,
            ended_at: pause.ended_at ?? endedAt,
          },
        ];
      }),
      ...(metrics
        ? {
            session_metrics: toSessionMetricsPayload(metrics),
            segment_metrics: segmentMetrics.flatMap((row) => {
              const segmentIndex = segmentIndexFor(segmentIndexes, row.segment_id);
              if (segmentIndex == null) return [];
              return [toSegmentMetricsPayload(row, segmentIndex)];
            }),
            sprint_efforts: sprintEfforts.flatMap((row) => {
              const segmentIndex = segmentIndexFor(segmentIndexes, row.segment_id);
              if (segmentIndex == null) return [];
              return [toSprintEffortPayload(row, segmentIndex)];
            }),
          }
        : {}),
    };

    await finalizeSession({ sessionId, body: finalizeBody });

    const uploads: TrackPointUpload[] = downsampled.flatMap((point) => {
      if (point.horizontal_accuracy_m == null || point.horizontal_accuracy_m <= 0) return [];
      const segmentIndex = segmentIndexFor(segmentIndexes, point.segment_id);
      if (segmentIndex == null) {
        console.warn('[sync] drop point without segment', point.id);
        return [];
      }
      return [
        {
          sequence_index: point.sequence_index,
          segment_index: segmentIndex,
          recorded_at: point.recorded_at,
          lat: point.lat,
          lng: point.lng,
          speed_kmh: point.speed_kmh,
          speed_accuracy_mps: point.speed_accuracy_mps,
          horizontal_accuracy_m: point.horizontal_accuracy_m,
        },
      ];
    });

    console.log('[sync] track points', {
      sessionId,
      storedCount: allPoints.length,
      downsampledCount: downsampled.length,
      uploadCount: uploads.length,
      stored: allPoints,
      downsampled,
      uploads,
    });

    for (const chunk of chunkPoints(uploads)) {
      await uploadTrackPoints({ sessionId, body: { points: chunk } });
    }

    await updateSessionFields(sessionId, { sync_status: 'synced' });
    await deletePointsForSession(sessionId);
    resetDelay(sessionId);
    return true;
  } catch (error) {
    console.error('[sync]', sessionId, error);
    if (isTerminalClientError(error)) {
      await updateSessionFields(sessionId, { sync_status: 'rejected' });
      resetDelay(sessionId);
      return false;
    }
    await updateSessionFields(sessionId, { sync_status: 'failed' });
    const delay = nextDelay(sessionId);
    setTimeout(() => {
      void processSyncQueue();
    }, delay);
    return false;
  } finally {
    inFlight.delete(sessionId);
  }
};

export const processSyncQueue = async () => {
  const pending = await getSessionsPendingSync();
  for (const session of pending) {
    await syncSession(session.id);
  }
};

export const enqueueSessionSync = (sessionId: string) => {
  void syncSession(sessionId);
};

export const startSyncListeners = () => {
  if (syncLoopStarted) return;
  syncLoopStarted = true;

  void processSyncQueue();

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void processSyncQueue();
    }
  });

  appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      void processSyncQueue();
    }
  });
};

export const stopSyncListeners = () => {
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = null;
  appStateSubscription?.remove();
  appStateSubscription = null;
  syncLoopStarted = false;
};
