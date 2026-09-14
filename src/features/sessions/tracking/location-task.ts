import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  ACCEPTED_FIX_ACCURACY_M,
  ANDROID_FGS_TITLE,
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
import { getForegroundPermissionStatus } from './permissions';
import type { PauseReason } from './types';

let startLock: Promise<void> = Promise.resolve();

const isForegroundServiceStartNotAllowed = (error: unknown) =>
  error instanceof Error &&
  error.message.includes(
    'Foreground service cannot be started when the application is in the background',
  );

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

const msSince = (iso: string | null) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);

const speedMsToKmh = (speedMs: number | null) =>
  speedMs != null && speedMs >= 0 ? speedMs * 3.6 : null;

const normalizeSpeedAccuracyMps = (value: number | null | undefined) =>
  value != null && value >= 0 ? value : null;

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
  const inActivity = session.current_segment_id != null;

  if (accepted) {
    await updateSessionFields(session.id, {
      last_accepted_fix_at: new Date(timestamp).toISOString(),
    });

    // If we're in an auto-pause and there's an open pause, resume from the auto-pause.
    if (inAutoPause && openPause && openPause.reason !== 'manual') {
      await resumeFromAutoPause(session.id);
    }

    // If we're not in a manual pause and there's no open pause, insert a track point. This is because manual pauses are handled by the app, not the OS.
    if (inActivity && !inManualPause && !(await getOpenPause(session.id))) {
      const speedKmh = speedMsToKmh(coords.speed);
      const coordsWithSpeedAccuracy = coords as typeof coords & {
        speedAccuracy?: number | null;
      };
      await insertTrackPoint({
        sessionId: session.id,
        segmentId: session.current_segment_id,
        recordedAt: new Date(timestamp).toISOString(),
        lat: coords.latitude,
        lng: coords.longitude,
        speedKmh,
        speedAccuracyMps: normalizeSpeedAccuracyMps(coordsWithSpeedAccuracy.speedAccuracy),
        horizontalAccuracyM: accuracy,
      });
    }
  } else if (!inManualPause && inActivity) {
    // Stay in "acquiring" until the first good lock — don't treat cold-start GPS as loss.
    if (!session.last_accepted_fix_at) return;

    const lastFixMs = msSince(session.last_accepted_fix_at);
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
  try {
    const { refreshTrackingIndicator } = await import('./indicator');
    await refreshTrackingIndicator();
  } catch (indicatorError) {
    console.warn('[location-task] indicator refresh failed', indicatorError);
  }
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
          notificationTitle: ANDROID_FGS_TITLE,
          notificationBody,
          notificationColor: '#C8F24E',
        },
      }
    : {}),
});

const whenAppActive = () => {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      sub.remove();
      resolve();
    });
  });
};

const startLocationTrackingOnce = async ({ notificationBody }: { notificationBody: string }) => {
  if (await isLocationTaskRunning()) return;
  if (!(await getForegroundPermissionStatus())) {
    throw new Error('Location permission is required to start tracking');
  }

  if (Platform.OS === 'android' && AppState.currentState !== 'active') {
    await whenAppActive();
    if (await isLocationTaskRunning()) return;
  }

  try {
    await Location.startLocationUpdatesAsync(
      LOCATION_TASK_NAME,
      buildLocationOptions({ notificationBody }),
    );
  } catch (error) {
    if (Platform.OS !== 'android' || !isForegroundServiceStartNotAllowed(error)) throw error;
    await whenAppActive();
    if (await isLocationTaskRunning()) return;
    await Location.startLocationUpdatesAsync(
      LOCATION_TASK_NAME,
      buildLocationOptions({ notificationBody }),
    );
  }
};

export const startLocationTracking = async ({ notificationBody }: { notificationBody: string }) => {
  const previous = startLock;
  let release = () => {};
  startLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    await startLocationTrackingOnce({ notificationBody });
  } finally {
    release();
  }
};

export const stopLocationTracking = async () => {
  const running = await isLocationTaskRunning();
  if (running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
};

/** Called when app backgrounds under When-In-Use iOS permission. */
export const handleAppBackgrounded = async () => {
  // Android uses a foreground service — keep tracking when the app is backgrounded.
  if (Platform.OS === 'android') return;

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
