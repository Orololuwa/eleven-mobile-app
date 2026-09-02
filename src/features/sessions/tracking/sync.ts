import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';
import { finalizeSession, uploadTrackPoints } from '../session-api';
import { SYNC_RETRY_INITIAL_MS, SYNC_RETRY_MAX_MS, TRACK_POINTS_CHUNK_SIZE } from './constants';
import { downsampleTrackPoints } from './downsample';
import {
  deletePointsForSession,
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getSessionsPendingSync,
  getTrackingSession,
  updateSessionFields,
} from './db';
import type { SessionFinalizeBody, TrackPointUpload } from './types';

const retryDelays = new Map<string, number>();
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

export const syncSession = async (sessionId: string): Promise<boolean> => {
  const session = await getTrackingSession(sessionId);
  if (!session?.ended_at) return false;
  if (session.sync_status === 'synced') return true;

  const net = await NetInfo.fetch();
  if (!net.isConnected) return false;

  await updateSessionFields(sessionId, {
    sync_status: 'syncing',
    sync_attempts: session.sync_attempts + 1,
    last_sync_attempt_at: new Date().toISOString(),
  });

  try {
    const segments = await getSegmentsForSession(sessionId);
    const pauses = await getPausesForSession(sessionId);
    const allPoints = await getPointsForSession(sessionId);
    const downsampled = downsampleTrackPoints(allPoints);

    const finalizeBody: SessionFinalizeBody = {
      ended_at: session.ended_at,
      segments: segments.map((segment) => ({
        segment_index: segment.segment_index,
        attack_direction: segment.attack_direction,
        started_at: segment.started_at,
        ended_at: segment.ended_at,
      })),
      pauses: pauses.map((pause) => ({
        segment_id: pause.segment_id,
        reason: pause.reason,
        started_at: pause.started_at,
        ended_at: pause.ended_at,
      })),
    };

    await finalizeSession({ sessionId, body: finalizeBody });

    const uploads: TrackPointUpload[] = downsampled.map((point) => ({
      sequence_index: point.sequence_index,
      segment_id: point.segment_id,
      recorded_at: point.recorded_at,
      lat: point.lat,
      lng: point.lng,
      speed_kmh: point.speed_kmh,
      horizontal_accuracy_m: point.horizontal_accuracy_m,
    }));

    for (const chunk of chunkPoints(uploads)) {
      await uploadTrackPoints({ sessionId, body: { points: chunk } });
    }

    await updateSessionFields(sessionId, { sync_status: 'synced' });
    await deletePointsForSession(sessionId);
    resetDelay(sessionId);
    return true;
  } catch (error) {
    console.error('[sync]', sessionId, error);
    await updateSessionFields(sessionId, { sync_status: 'failed' });
    const delay = nextDelay(sessionId);
    setTimeout(() => {
      void processSyncQueue();
    }, delay);
    return false;
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
