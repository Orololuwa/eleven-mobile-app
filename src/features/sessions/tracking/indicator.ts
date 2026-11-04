import { AppState, Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';
import * as Location from 'expo-location';
import { darkColors as colors } from '@/theme';
import { useAppStore } from '@/stores/app-store';
import {
  dismissAndroidTrackingNotification,
  updateAndroidTrackingNotification,
} from './android-notification';
import { ANDROID_FGS_TITLE, INDICATOR_UPDATE_INTERVAL_MS, LOCATION_TASK_NAME } from './constants';
import { getActiveTrackingSession } from './db';
import { formatDistance, formatElapsedLong, formatSpeed } from './live-metrics';
import { readFreshLiveSnapshot } from './live-snapshot';
import { chronometerBaseMs, elapsedSecondsAt } from './live-snapshot-model';
import type { LiveSignal, TrackingSegmentRow, TrackingSessionRow } from './types';
import { segmentLabelFor } from '../segment-display';

/** Body + chronometer base last posted; skips identical re-posts. */
let lastAndroidNotificationKey: string | null = null;
let lastDistanceUnit: 'km' | 'mi' = 'km';
let lastIndicatorPushAt = 0;
/**
 * Bumped when the session's indicator stops. A refresh that began earlier (it waits on SQLite for
 * the snapshot) must not post afterwards: that re-created the notification, frozen, after the
 * session ended (4 Nov run), and its fallback could restart location updates.
 */
let indicatorGeneration = 0;
/** Android update currently talking to the native module — the stop waits for it. */
let androidPushInFlight: Promise<void> | null = null;

type IndicatorSnapshot = {
  elapsedSeconds: number;
  /** Null when the summary would suppress it; the indicator then shows the signal state instead. */
  distanceKm: number | null;
  topSpeedKmh: number | null;
  signal: LiveSignal;
  segmentLabel: string;
  distanceUnit: 'km' | 'mi';
  /**
   * Android: wall time the running clock reads 0:00 at. The notification's system chronometer ticks
   * every second from it, so the body leaves the clock out. Null/absent → the body prints the time.
   */
  chronometerBaseMs?: number | null;
};

const SIGNAL_LABEL: Record<Exclude<LiveSignal, 'good'>, string> = {
  estimated: 'SIGNAL WEAK',
  settling: 'MEASURING',
  recovering: 'SIGNAL BACK',
  poor: 'POOR SIGNAL',
  offline: 'NO GPS FIXES',
};

const signalLabel = (signal: LiveSignal) => (signal === 'good' ? '' : SIGNAL_LABEL[signal]);

const formatReadout = (
  {
    elapsedSeconds,
    distanceKm,
    topSpeedKmh,
    signal,
    distanceUnit,
  }: Omit<IndicatorSnapshot, 'segmentLabel' | 'chronometerBaseMs'>,
  { includeClock = true }: { includeClock?: boolean } = {},
) => {
  const parts = includeClock ? [formatElapsedLong(elapsedSeconds)] : [];
  if (distanceKm == null || topSpeedKmh == null) {
    const label = signalLabel(signal);
    if (label) parts.push(label);
    return parts.join(' · ') || 'TRACKING';
  }
  const distance = formatDistance({ km: distanceKm, unit: distanceUnit });
  const speed = formatSpeed({ kmh: topSpeedKmh, unit: distanceUnit });
  const distanceSuffix = distanceUnit === 'mi' ? 'MI' : 'KM';
  const speedSuffix = distanceUnit === 'mi' ? 'MPH' : 'KM/H';
  parts.push(`${distance} ${distanceSuffix}`, `TOP ${speed} ${speedSuffix}`);
  if (signal === 'estimated') parts.push(signalLabel(signal));
  return parts.join(' · ');
};

const liveActivityConfig: LiveActivity.LiveActivityConfig = {
  backgroundColor: colors.background.secondary,
  titleColor: colors.text.primary,
  subtitleColor: colors.brand.fill,
  progressViewTint: colors.brand.fill,
  progressViewLabelColor: colors.text.primary,
  deepLinkUrl: '/active-session',
  timerType: 'digital',
};

const resolveSegmentLabel = (
  session: TrackingSessionRow,
  segment: TrackingSegmentRow | null,
  allSegments: TrackingSegmentRow[] = [],
): string =>
  segmentLabelFor({
    session: {
      session_type: session.session_type,
      play_structure: session.play_structure,
    },
    segment,
    allSegments,
  });

const resolveDistanceUnit = (distanceUnit?: 'km' | 'mi'): 'km' | 'mi' => {
  if (distanceUnit) {
    lastDistanceUnit = distanceUnit;
    return distanceUnit;
  }
  const stored = useAppStore.getState().units.distance;
  if (stored === 'mi' || stored === 'km') {
    lastDistanceUnit = stored;
    return stored;
  }
  return lastDistanceUnit;
};

export const buildNotificationBody = (snapshot: Omit<IndicatorSnapshot, 'segmentLabel'>) =>
  formatReadout(snapshot, { includeClock: snapshot.chronometerBaseMs == null });

const buildLiveActivityState = ({
  segmentLabel,
  ...snapshot
}: IndicatorSnapshot): LiveActivity.LiveActivityState => ({
  title: `TRACKING · ${segmentLabel.toUpperCase()}`,
  subtitle: formatReadout(snapshot),
});

const androidLocationOptions = (notificationBody: string): Location.LocationTaskOptions => ({
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: ANDROID_FGS_TITLE,
    notificationBody,
    notificationColor: colors.brand.fill,
  },
});

const updateAndroidIndicator = async ({
  notificationBody,
  chronometerBase = null,
  generation,
}: {
  notificationBody: string;
  chronometerBase?: number | null;
  generation: number;
}) => {
  if (generation !== indicatorGeneration) return;
  const key = `${notificationBody}|${chronometerBase ?? ''}`;
  if (key === lastAndroidNotificationKey) return;
  lastAndroidNotificationKey = key;

  const run = (async () => {
    const updatedInPlace = await updateAndroidTrackingNotification({
      title: ANDROID_FGS_TITLE,
      body: notificationBody,
      color: colors.brand.fill,
      chronometerBaseMs: chronometerBase,
    });
    if (updatedInPlace) return;

    if (AppState.currentState !== 'active') {
      lastAndroidNotificationKey = null;
      return;
    }

    // No notification to update. Rebuild it by re-registering — only for a session still live.
    const session = await getActiveTrackingSession();
    if (generation !== indicatorGeneration || !session || session.ended_at) return;
    try {
      await Location.startLocationUpdatesAsync(
        LOCATION_TASK_NAME,
        androidLocationOptions(notificationBody),
      );
    } catch {
      // fall through — the next refresh retries
    }
    // Expo rebuilt the notification from options (no chronometer); post ours again next refresh.
    lastAndroidNotificationKey = null;
  })();
  androidPushInFlight = run;
  try {
    await run;
  } finally {
    if (androidPushInFlight === run) androidPushInFlight = null;
  }
};

/**
 * Expo rebuilds the FGS notification from task options whenever `startLocationUpdatesAsync` runs
 * (registration renew), dropping our body and chronometer. Forget what we posted so the next
 * refresh re-posts it.
 */
export const invalidateAndroidIndicator = () => {
  lastAndroidNotificationKey = null;
  lastIndicatorPushAt = 0;
};

export const startTrackingIndicator = async ({
  session,
  segment,
  allSegments = [],
  snapshot,
  distanceUnit,
}: {
  session: TrackingSessionRow;
  segment: TrackingSegmentRow | null;
  allSegments?: TrackingSegmentRow[];
  snapshot: Omit<IndicatorSnapshot, 'segmentLabel' | 'distanceUnit'>;
  distanceUnit: 'km' | 'mi';
}) => {
  const unit = resolveDistanceUnit(distanceUnit);
  const fullSnapshot: IndicatorSnapshot = {
    ...snapshot,
    segmentLabel: resolveSegmentLabel(session, segment, allSegments),
    distanceUnit: unit,
  };
  const notificationBody = buildNotificationBody(fullSnapshot);

  if (Platform.OS === 'ios') {
    const state = buildLiveActivityState(fullSnapshot);
    const activityId = LiveActivity.startActivity(state, liveActivityConfig);
    return activityId ?? null;
  }

  await updateAndroidIndicator({
    notificationBody,
    chronometerBase: fullSnapshot.chronometerBaseMs ?? null,
    generation: indicatorGeneration,
  });
  return null;
};

const pushTrackingIndicator = async ({
  liveActivityId,
  segmentLabel,
  snapshot,
  distanceUnit,
  generation,
}: {
  liveActivityId: string | null;
  segmentLabel: string;
  snapshot: Omit<IndicatorSnapshot, 'segmentLabel' | 'distanceUnit'>;
  distanceUnit: 'km' | 'mi';
  generation: number;
}) => {
  const unit = resolveDistanceUnit(distanceUnit);
  const fullSnapshot: IndicatorSnapshot = { ...snapshot, segmentLabel, distanceUnit: unit };
  const notificationBody = buildNotificationBody(fullSnapshot);

  if (Platform.OS === 'ios' && liveActivityId) {
    try {
      LiveActivity.updateActivity(liveActivityId, buildLiveActivityState(fullSnapshot));
    } catch (error) {
      console.warn('[indicator] Live Activity update failed', error);
    }
    return;
  }

  if (Platform.OS === 'android') {
    await updateAndroidIndicator({
      notificationBody,
      chronometerBase: fullSnapshot.chronometerBaseMs ?? null,
      generation,
    });
  }
};

export const stopTrackingIndicator = async (liveActivityId: string | null) => {
  if (Platform.OS === 'ios' && liveActivityId) {
    try {
      LiveActivity.stopActivity(liveActivityId, { title: 'Session ended' });
    } catch (error) {
      console.warn('[indicator] Live Activity stop failed', error);
    }
  }
  lastAndroidNotificationKey = null;
  lastIndicatorPushAt = 0;
  indicatorGeneration += 1;
  if (Platform.OS === 'android') {
    // Let an update already in the native call land, then clear whatever it left.
    await androidPushInFlight?.catch(() => undefined);
    await dismissAndroidTrackingNotification();
  }
};

/** App start with no live session: clear a notification an older build left behind. */
export const clearStaleTrackingIndicator = async () => {
  if (Platform.OS !== 'android') return;
  const session = await getActiveTrackingSession();
  if (!session) await dismissAndroidTrackingNotification();
};

export const refreshTrackingIndicator = async ({
  distanceUnit,
  force = false,
}: {
  distanceUnit?: 'km' | 'mi';
  force?: boolean;
} = {}) => {
  const now = Date.now();
  if (!force && now - lastIndicatorPushAt < INDICATOR_UPDATE_INTERVAL_MS) return;
  const generation = indicatorGeneration;

  const session = await getActiveTrackingSession();
  if (!session || session.ended_at || session.tracking_status === 'ended') return;

  // The location task keeps this current; recomputed here only if the task has gone quiet.
  const live = await readFreshLiveSnapshot(session.id);
  if (!live || generation !== indicatorGeneration) return;
  const clock = live.segmentId ? live.clock : live.sessionClock;

  lastIndicatorPushAt = now;
  await pushTrackingIndicator({
    liveActivityId: session.live_activity_id,
    segmentLabel: live.segmentLabel,
    snapshot: {
      elapsedSeconds: elapsedSecondsAt(clock, now),
      distanceKm: live.metrics.distanceKm,
      topSpeedKmh: live.metrics.topSpeedKmh,
      signal: live.metrics.signal,
      chronometerBaseMs: chronometerBaseMs(clock),
    },
    distanceUnit: resolveDistanceUnit(distanceUnit),
    generation,
  });
};
