import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  ACCEPTED_FIX_ACCURACY_M,
  AUTO_RESUME_COOLDOWN_MS,
  GPS_LOSS_PAUSE_MS,
  LOCATION_TASK_NAME,
} from './constants';
import {
  closeOpenPause,
  closePause,
  getActiveTrackingSession,
  getOpenPause,
  insertPause,
  insertTrackPoint,
  updateSessionFields,
} from './db';
import type { PauseReason } from './types';

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

const msSince = (iso: string | null) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);

const speedMsToKmh = (speedMs: number | null) =>
  speedMs != null && speedMs >= 0 ? speedMs * 3.6 : null;

const startAutoPause = async ({
  sessionId,
  segmentId,
  reason,
}: {
  sessionId: string;
  segmentId: string | null;
  reason: PauseReason;
}) => {
  const existing = await getOpenPause(sessionId);
  if (existing) return;

  await insertPause({ sessionId, segmentId, reason });
  await updateSessionFields(sessionId, {
    tracking_status: 'auto_pause',
    gps_search_started_at: reason === 'gps_loss' ? new Date().toISOString() : null,
  });
};

const resumeFromAutoPause = async (sessionId: string) => {
  const openPause = await getOpenPause(sessionId);
  if (!openPause || openPause.reason === 'manual') return;

  await closePause(openPause.id);
  await updateSessionFields(sessionId, {
    tracking_status: 'live',
    auto_resume_cooldown_until: new Date(Date.now() + AUTO_RESUME_COOLDOWN_MS).toISOString(),
    gps_search_started_at: null,
  });
};

export const processLocationUpdate = async (locations: Location.LocationObject[]) => {
  const session = await getActiveTrackingSession();
  if (!session || session.tracking_status === 'ended' || session.ended_at) return;

  const latest = locations[locations.length - 1];
  if (!latest) return;

  const { coords, timestamp } = latest;
  const accuracy = coords.accuracy;
  const accepted =
    accuracy != null && accuracy < ACCEPTED_FIX_ACCURACY_M && coords.latitude && coords.longitude;

  const openPause = await getOpenPause(session.id);
  const inManualPause = session.tracking_status === 'manual_pause';
  const inAutoPause = session.tracking_status === 'auto_pause';

  if (accepted) {
    await updateSessionFields(session.id, {
      last_accepted_fix_at: new Date(timestamp).toISOString(),
    });

    // If we're in an auto-pause and there's an open pause, resume from the auto-pause.
    if (inAutoPause && openPause && openPause.reason !== 'manual') {
      await resumeFromAutoPause(session.id);
    }

    // If we're not in a manual pause and there's no open pause, insert a track point. This is because manual pauses are handled by the app, not the OS.
    if (!inManualPause && !(await getOpenPause(session.id))) {
      const speedKmh = speedMsToKmh(coords.speed);
      const sequenceIndex = session.next_sequence_index;
      await insertTrackPoint({
        sessionId: session.id,
        segmentId: session.current_segment_id,
        sequenceIndex,
        recordedAt: new Date(timestamp).toISOString(),
        lat: coords.latitude,
        lng: coords.longitude,
        speedKmh,
        horizontalAccuracyM: accuracy,
      });
      await updateSessionFields(session.id, { next_sequence_index: sequenceIndex + 1 });
    }
  } else if (!inManualPause) {
    const lastFixReference = session.last_accepted_fix_at ?? session.started_at;
    const lastFixMs = msSince(lastFixReference);
    const cooldownActive =
      session.auto_resume_cooldown_until != null &&
      Date.now() < new Date(session.auto_resume_cooldown_until).getTime();

    if (!inAutoPause && !cooldownActive && lastFixMs > GPS_LOSS_PAUSE_MS) {
      await startAutoPause({
        sessionId: session.id,
        segmentId: session.current_segment_id,
        reason: 'gps_loss',
      });
    }
  }
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[location-task]', error);
    return;
  }
  const { locations } = (data ?? {}) as LocationTaskData;
  if (!locations?.length) return;
  await processLocationUpdate(locations);
});

export const isLocationTaskRunning = async () =>
  Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

export const buildLocationOptions = ({
  notificationBody,
}: {
  notificationBody: string;
}): Location.LocationTaskOptions => ({
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  ...(Platform.OS === 'android'
    ? {
        foregroundService: {
          notificationTitle: 'Eleven — tracking your session',
          notificationBody,
          notificationColor: '#C8F24E',
        },
      }
    : {}),
});

export const startLocationTracking = async ({ notificationBody }: { notificationBody: string }) => {
  const running = await isLocationTaskRunning();
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  await Location.startLocationUpdatesAsync(
    LOCATION_TASK_NAME,
    buildLocationOptions({ notificationBody }),
  );
};

export const stopLocationTracking = async () => {
  const running = await isLocationTaskRunning();
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};

/** Called when app backgrounds under When-In-Use iOS permission. */
export const handleAppBackgrounded = async () => {
  const session = await getActiveTrackingSession();
  if (!session || session.tracking_status !== 'live') return;
  if (session.background_permission === 'always') return;

  const openPause = await getOpenPause(session.id);
  if (openPause) return;

  await insertPause({
    sessionId: session.id,
    segmentId: session.current_segment_id,
    reason: 'backgrounded',
  });
  await updateSessionFields(session.id, { tracking_status: 'auto_pause' });
};

/** Called when app returns to foreground — resume backgrounded auto-pause. */
export const handleAppForegrounded = async () => {
  const session = await getActiveTrackingSession();
  if (!session) return;

  const openPause = await getOpenPause(session.id);
  if (openPause?.reason === 'backgrounded') {
    await closePause(openPause.id);
    await updateSessionFields(session.id, {
      tracking_status: 'live',
      auto_resume_cooldown_until: new Date(Date.now() + AUTO_RESUME_COOLDOWN_MS).toISOString(),
    });
  }
};

export const startManualPause = async (sessionId: string) => {
  const session = await getActiveTrackingSession();
  if (!session || session.id !== sessionId) return;

  await closeOpenPause(sessionId);
  await insertPause({
    sessionId,
    segmentId: session.current_segment_id,
    reason: 'manual',
  });
  await updateSessionFields(sessionId, { tracking_status: 'manual_pause' });
};

export const resumeManualPause = async (sessionId: string) => {
  const session = await getActiveTrackingSession();
  if (!session || session.id !== sessionId) return;

  const openPause = await getOpenPause(sessionId);
  if (openPause?.reason === 'manual') {
    await closePause(openPause.id);
  }
  await updateSessionFields(sessionId, { tracking_status: 'live' });
};
