import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  ANDROID_FGS_TITLE,
  AUTO_RESUME_COOLDOWN_MS,
  GPS_LOSS_PAUSE_MS,
  LOCATION_FIX_STALE_MS,
  LOCATION_TASK_NAME,
  LOCATION_WATCHDOG_INTERVAL_MS,
} from './constants';
import {
  closeOpenPause,
  closePause,
  getActiveTrackingSession,
  getOpenPause,
  insertPause,
  insertTrackPoint,
  recordLatestFix,
  updateSessionFields,
} from './db';
import { isFixFeedStale, watchShouldYieldToTask } from './fix-feed';
import { passesContinuityGate } from './fix-gates';
import { getLatestFix, setLatestFix } from './latest-fix';
import { refreshLiveSnapshot } from './live-snapshot';
import { getForegroundPermissionStatus } from './permissions';
import { needsForcedRenew, shouldWaitForAppActive } from './registration-recovery';
import { nextTeardownAction } from './registration-teardown';
import type { LatestFix, PauseReason } from './types';

let startLock: Promise<void> = Promise.resolve();
let stopInFlight: Promise<void> | null = null;
let lastProcessedAt = 0;
/** Deliveries (task + watch) run one at a time — interleaved fixes raced pauses and DB reads. */
let processQueue: Promise<void> = Promise.resolve();
/** Wall time of the last direct-GPS (task) delivery; the fused watch yields while it is recent. */
let lastTaskDeliveryAtMs: number | null = null;
let foregroundWatch: Location.LocationSubscription | null = null;
let consecutiveNullSessions = 0;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let lastNotificationBody = 'Tracking session…';
/** Cleared at the first line of stop; set when start succeeds. Leftover fixes with no session stop. */
let trackingDesired = false;
let lastNullSessionWarnAtMs = 0;

export type { LatestFix };

export type RegistrationReason =
  'start' | 'stop' | 'watchdog' | 'foreground' | 'app-state' | 'ended';

/** Newest fix delivered by the OS, stored or not — the GPS label reflects the signal, not storage. */
export { getLatestFix };

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
  segmentId: string;
  reason: PauseReason;
}) => {
  const existing = await getOpenPause(sessionId);
  if (existing) return;

  await insertPause({ sessionId, segmentId, reason });
  await updateSessionFields(sessionId, {
    tracking_status: 'auto_pause',
    gps_search_started_at: reason === 'gps_loss' ? new Date().toISOString() : null,
  });
  void refreshIndicatorNow(sessionId).catch(() => undefined);
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
  void refreshIndicatorNow(sessionId).catch(() => undefined);
};

/** Pause / resume flips the notification chronometer — push it now, not on the 5 s throttle. */
const refreshIndicatorNow = async (sessionId: string) => {
  await refreshLiveSnapshot({ sessionId, force: true });
  const { refreshTrackingIndicator } = await import('./indicator');
  await refreshTrackingIndicator({ force: true });
};

type FixContext = { source: 'task' | 'watch'; intervalMs: number | null; batchSize: number };

/**
 * Every fix in a delivery is processed, oldest first. Android batches fixes on battery-managed
 * devices; keeping only the newest would leave gaps wider than the bridge window and nothing would
 * be measured even with accurate fixes.
 */
export const processLocationUpdate = (
  locations: Location.LocationObject[],
  { source = 'task' }: { source?: 'task' | 'watch' } = {},
) => {
  const run = processQueue.then(() => processLocationBatch(locations, source));
  processQueue = run.catch(() => undefined);
  return run;
};

const processLocationBatch = async (
  locations: Location.LocationObject[],
  source: 'task' | 'watch',
) => {
  // Direct GPS is the session's source of truth; the fused watch only fills in when it is quiet.
  if (source === 'task') {
    lastTaskDeliveryAtMs = Date.now();
  } else if (watchShouldYieldToTask({ lastTaskDeliveryAtMs })) {
    return;
  }

  const fresh = [...locations]
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((location) => location.timestamp > lastProcessedAt);
  const newest = fresh[fresh.length - 1];
  if (!newest) return;

  const previousProcessedAt = lastProcessedAt;
  lastProcessedAt = newest.timestamp;
  const fix: LatestFix = { accuracyM: newest.coords.accuracy, atMs: newest.timestamp };
  setLatestFix(fix);
  await recordLatestFix(fix);

  for (const [index, location] of fresh.entries()) {
    const previousAt = index === 0 ? previousProcessedAt : (fresh[index - 1]?.timestamp ?? 0);
    const shouldContinue = await processFix(location, {
      source,
      intervalMs: previousAt > 0 ? location.timestamp - previousAt : null,
      batchSize: fresh.length,
    });
    if (!shouldContinue) return;
  }

  // The task owns the live numbers: HUD, notification and Live Activity read this snapshot.
  // Not awaited — a long session's metrics pass must not hold up the next delivery.
  void refreshLiveSnapshot().catch((error) => {
    console.warn('[location-task] live snapshot refresh failed', error);
  });
};

const processFix = async (
  location: Location.LocationObject,
  { source, intervalMs, batchSize }: FixContext,
): Promise<boolean> => {
  const session = await getActiveTrackingSession();
  const teardown = nextTeardownAction({
    session,
    previousNullCount: consecutiveNullSessions,
    trackingDesired,
  });
  consecutiveNullSessions = teardown.nullCount;

  if (teardown.action === 'stop') {
    void stopLocationTracking({ reason: teardown.reason === 'tracking-off' ? 'stop' : 'ended' });
    return false;
  }
  if (teardown.action === 'skip' || !session) {
    const now = Date.now();
    if (now - lastNullSessionWarnAtMs >= 5_000) {
      lastNullSessionWarnAtMs = now;
      console.warn('[location-task] skip fix — no live session', {
        reason: teardown.reason,
        nullCount: consecutiveNullSessions,
        source,
      });
    }
    return false;
  }

  const { coords, timestamp } = location;
  const accuracy = coords.accuracy;
  const hasCoords = coords.latitude != null && coords.longitude != null;
  const isAlive = passesContinuityGate(accuracy);

  const openPause = await getOpenPause(session.id);
  const inManualPause = session.tracking_status === 'manual_pause';
  const inAutoPause = session.tracking_status === 'auto_pause';
  const inActivity = session.current_segment_id != null;

  if (hasCoords && isAlive) {
    await updateSessionFields(session.id, {
      last_accepted_fix_at: new Date(timestamp).toISOString(),
    });

    if (inAutoPause && openPause && openPause.reason !== 'manual') {
      await resumeFromAutoPause(session.id);
    }
  }

  const canInsert =
    hasCoords &&
    isAlive &&
    inActivity &&
    session.current_segment_id != null &&
    !inManualPause &&
    !(await getOpenPause(session.id));

  if (canInsert && session.current_segment_id) {
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
    console.log('[location-task] point', {
      source,
      sessionId: session.id,
      accuracy,
      intervalMs,
      batchSize,
      lat: coords.latitude,
      lng: coords.longitude,
      speedKmh,
    });
    return true;
  }

  console.log('[location-task] skip', {
    source,
    reason: !hasCoords
      ? 'no-coords'
      : !isAlive
        ? 'continuity-gate'
        : !inActivity
          ? 'no-activity'
          : inManualPause
            ? 'manual-pause'
            : openPause
              ? `pause:${openPause.reason}`
              : 'unknown',
    accuracy,
    trackingStatus: session.tracking_status,
  });

  if (!hasCoords || inManualPause || !inActivity) return true;
  if (isAlive) return true;
  if (!session.last_accepted_fix_at) return true;

  const lastFixMs = msSince(session.last_accepted_fix_at);
  const cooldownActive =
    session.auto_resume_cooldown_until != null &&
    Date.now() < new Date(session.auto_resume_cooldown_until).getTime();

  if (
    !inAutoPause &&
    !cooldownActive &&
    lastFixMs > GPS_LOSS_PAUSE_MS &&
    session.current_segment_id
  ) {
    await startAutoPause({
      sessionId: session.id,
      segmentId: session.current_segment_id,
      reason: 'gps_loss',
    });
  }
  return true;
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[location-task]', error);
    return;
  }
  const { locations } = (data ?? {}) as LocationTaskData;
  if (!locations?.length) return;
  try {
    await processLocationUpdate(locations, { source: 'task' });
  } catch (taskError) {
    console.warn('[location-task] process failed', taskError);
    return;
  }
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

const stopForegroundWatch = () => {
  foregroundWatch?.remove();
  foregroundWatch = null;
};

const ensureForegroundWatch = async () => {
  if (foregroundWatch) return;
  foregroundWatch = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
    },
    (location) => {
      void processLocationUpdate([location], { source: 'watch' }).catch((error) => {
        console.warn('[location-task] watch process failed', error);
      });
    },
  );
};

const clearWatchdog = () => {
  if (!watchdogTimer) return;
  clearInterval(watchdogTimer);
  watchdogTimer = null;
};

const startWatchdog = () => {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    void ensureLocationRegistration({ reason: 'watchdog' }).catch((error) => {
      console.warn('[location-task] watchdog failed', error);
    });
  }, LOCATION_WATCHDOG_INTERVAL_MS);
};

const hasLiveSession = async () => {
  const session = await getActiveTrackingSession();
  return session != null && session.tracking_status !== 'ended' && !session.ended_at;
};

const startLocationUpdates = async (notificationBody: string) => {
  await Location.startLocationUpdatesAsync(
    LOCATION_TASK_NAME,
    buildLocationOptions({ notificationBody }),
  );
  // Expo rebuilt the FGS notification from these options — re-post ours (body + chronometer).
  const { invalidateAndroidIndicator } = await import('./indicator');
  invalidateAndroidIndicator();
};

/**
 * While a session is live, assert that the location task is registered and a fix arrived recently.
 * Forces a renew when the feed is stale even if Expo still reports the task as started (GMS can
 * drop the fused→GPS request while hasStartedLocationUpdatesAsync stays true).
 */
export const ensureLocationRegistration = async ({
  reason,
}: {
  reason: Extract<RegistrationReason, 'watchdog' | 'foreground' | 'app-state'>;
}) => {
  if (!(await hasLiveSession())) return;

  const running = await isLocationTaskRunning();
  const latestFix = getLatestFix();
  const feedStale = isFixFeedStale({ fix: latestFix, staleMs: LOCATION_FIX_STALE_MS });
  if (!needsForcedRenew({ running, feedStale })) return;

  console.log('[location-task] registration re-register', {
    reason,
    running,
    feedStale,
    forceRenew: true,
    latestFixAtMs: latestFix?.atMs ?? null,
  });

  try {
    await startLocationTracking({
      notificationBody: lastNotificationBody,
      reason,
      forceRenew: true,
    });
  } catch (error) {
    if (Platform.OS === 'android' && isForegroundServiceStartNotAllowed(error)) {
      console.warn('[location-task] re-register deferred — FGS not allowed in background', {
        reason,
      });
      return;
    }
    throw error;
  }
};

const startLocationTrackingOnce = async ({
  notificationBody,
  reason,
  forceRenew = false,
}: {
  notificationBody: string;
  reason: RegistrationReason;
  forceRenew?: boolean;
}) => {
  if (stopInFlight) await stopInFlight;

  if (!(await getForegroundPermissionStatus())) {
    throw new Error('Location permission is required to start tracking');
  }

  lastNotificationBody = notificationBody;
  const running = await isLocationTaskRunning();
  const waitForActive = shouldWaitForAppActive(reason);

  // Force renew: always call startLocationUpdatesAsync even when Expo still reports the task as
  // started. On Android that re-registers LocationManager GPS_PROVIDER (with-direct-gps), not fused.
  if (forceRenew || !running) {
    if (
      !running &&
      waitForActive &&
      Platform.OS === 'android' &&
      AppState.currentState !== 'active'
    ) {
      await whenAppActive();
      if ((await isLocationTaskRunning()) && !forceRenew) {
        if (!stopInFlight) trackingDesired = true;
        await ensureForegroundWatch();
        startWatchdog();
        console.log('[location-task] registration start', { reason, alreadyRunning: true });
        return;
      }
    }

    try {
      await startLocationUpdates(notificationBody);
    } catch (error) {
      if (Platform.OS !== 'android' || !isForegroundServiceStartNotAllowed(error)) throw error;
      // Recovery must not hold startLock on whenAppActive — unlock / next tick retries.
      if (!waitForActive) throw error;
      await whenAppActive();
      if (!(await isLocationTaskRunning()) || forceRenew) {
        await startLocationUpdates(notificationBody);
      }
    }
  }

  // A stop queued while we held the lock wins — do not re-arm desire after user end.
  if (!stopInFlight) trackingDesired = true;
  await ensureForegroundWatch();
  startWatchdog();
  console.log('[location-task] registration start', { reason, forceRenew, wasRunning: running });
};

export const startLocationTracking = async ({
  notificationBody,
  reason = 'start',
  forceRenew = false,
}: {
  notificationBody: string;
  reason?: RegistrationReason;
  forceRenew?: boolean;
}) => {
  const previous = startLock;
  let release = () => {};
  startLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    await startLocationTrackingOnce({ notificationBody, reason, forceRenew });
  } finally {
    release();
  }
};

export const stopLocationTracking = async ({
  reason = 'stop',
}: {
  reason?: RegistrationReason;
} = {}) => {
  // Drop desire immediately so in-flight / leftover fixes tear down instead of skip-flooding.
  trackingDesired = false;
  if (stopInFlight) return stopInFlight;
  stopInFlight = (async () => {
    await startLock;
    trackingDesired = false;
    clearWatchdog();
    stopForegroundWatch();
    lastProcessedAt = 0;
    lastTaskDeliveryAtMs = null;
    setLatestFix(null);
    consecutiveNullSessions = 0;
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch {
      // Task was already stopped.
    }
    console.log('[location-task] registration stop', { reason });
  })().finally(() => {
    stopInFlight = null;
  });
  return stopInFlight;
};

/** Called when app backgrounds under When-In-Use iOS permission. */
export const handleAppBackgrounded = async () => {
  // Android uses a foreground service — keep tracking when the app is backgrounded.
  if (Platform.OS === 'android') return;

  const session = await getActiveTrackingSession();
  if (!session || session.tracking_status !== 'live') return;
  if (session.background_permission === 'always') return;
  if (!session.current_segment_id) return;

  const openPause = await getOpenPause(session.id);
  if (openPause) return;

  await insertPause({
    sessionId: session.id,
    segmentId: session.current_segment_id,
    reason: 'backgrounded',
  });
  await updateSessionFields(session.id, { tracking_status: 'auto_pause' });
};

/**
 * AppState cue (inactive / background / active): renew registration if the fix feed is stale.
 * Unlock must force-renew even when Expo still reports the task as started.
 */
export const handleAppStateForRegistration = async () => {
  if (!(await getForegroundPermissionStatus())) return;
  const session = await getActiveTrackingSession();
  if (!session || session.tracking_status === 'ended' || session.ended_at) return;
  await ensureLocationRegistration({ reason: 'app-state' });
};

/** Called when app returns to foreground — resume backgrounded auto-pause. */
export const handleAppForegrounded = async () => {
  const session = await getActiveTrackingSession();
  if (!session) return;

  if (session.tracking_status !== 'ended' && !session.ended_at) {
    if (await getForegroundPermissionStatus()) {
      await ensureForegroundWatch();
      await ensureLocationRegistration({ reason: 'app-state' });
    }
    // Back from lock / a freeze: repaint from a fresh pass, not whatever was left before sleep.
    await refreshLiveSnapshot({ sessionId: session.id, force: true });
  }

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
  if (!session || session.id !== sessionId || !session.current_segment_id) return;

  await closeOpenPause(sessionId);
  await insertPause({
    sessionId,
    segmentId: session.current_segment_id,
    reason: 'manual',
  });
  await updateSessionFields(sessionId, { tracking_status: 'manual_pause' });
  await refreshIndicatorNow(sessionId);
};

export const resumeManualPause = async (sessionId: string) => {
  const session = await getActiveTrackingSession();
  if (!session || session.id !== sessionId) return;

  const openPause = await getOpenPause(sessionId);
  if (openPause?.reason === 'manual') {
    await closePause(openPause.id);
  }
  await updateSessionFields(sessionId, { tracking_status: 'live' });
  await refreshIndicatorNow(sessionId);
};
