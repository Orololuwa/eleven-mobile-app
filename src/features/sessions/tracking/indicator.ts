import { AppState, Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';
import * as Location from 'expo-location';
import { darkColors as colors } from '@/theme';
import { useAppStore } from '@/stores/app-store';
import { updateAndroidTrackingNotification } from './android-notification';
import { ANDROID_FGS_TITLE, INDICATOR_UPDATE_INTERVAL_MS, LOCATION_TASK_NAME } from './constants';
import { getActiveTrackingSession } from './db';
import { formatDistance, formatElapsedLong, formatSpeed } from './live-metrics';
import { readFreshLiveSnapshot } from './live-snapshot';
import { elapsedSecondsAt } from './live-snapshot-model';
import type { LiveSignal, TrackingSegmentRow, TrackingSessionRow } from './types';
import { segmentLabelFor } from '../segment-display';

let lastAndroidNotificationBody: string | null = null;
let lastDistanceUnit: 'km' | 'mi' = 'km';
let lastIndicatorPushAt = 0;

type IndicatorSnapshot = {
  elapsedSeconds: number;
  /** Null when the summary would suppress it; the indicator then shows the signal state instead. */
  distanceKm: number | null;
  topSpeedKmh: number | null;
  signal: LiveSignal;
  segmentLabel: string;
  distanceUnit: 'km' | 'mi';
};

const SIGNAL_LABEL: Record<Exclude<LiveSignal, 'good'>, string> = {
  estimated: 'SIGNAL WEAK',
  settling: 'MEASURING',
  recovering: 'SIGNAL BACK',
  poor: 'POOR SIGNAL',
  offline: 'NO GPS FEED',
};

const signalLabel = (signal: LiveSignal) => (signal === 'good' ? '' : SIGNAL_LABEL[signal]);

const formatReadout = ({
  elapsedSeconds,
  distanceKm,
  topSpeedKmh,
  signal,
  distanceUnit,
}: Omit<IndicatorSnapshot, 'segmentLabel'>) => {
  const elapsed = formatElapsedLong(elapsedSeconds);
  if (distanceKm == null || topSpeedKmh == null) return `${elapsed} · ${signalLabel(signal)}`;
  const distance = formatDistance({ km: distanceKm, unit: distanceUnit });
  const speed = formatSpeed({ kmh: topSpeedKmh, unit: distanceUnit });
  const distanceSuffix = distanceUnit === 'mi' ? 'MI' : 'KM';
  const speedSuffix = distanceUnit === 'mi' ? 'MPH' : 'KM/H';
  const readout = `${elapsed} · ${distance} ${distanceSuffix} · TOP ${speed} ${speedSuffix}`;
  return signal === 'estimated' ? `${readout} · ${signalLabel(signal)}` : readout;
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
  formatReadout(snapshot);

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

const updateAndroidIndicator = async (notificationBody: string) => {
  if (notificationBody === lastAndroidNotificationBody) return;
  lastAndroidNotificationBody = notificationBody;

  const updatedInPlace = await updateAndroidTrackingNotification({
    title: ANDROID_FGS_TITLE,
    body: notificationBody,
    color: colors.brand.fill,
  });
  if (updatedInPlace) return;

  if (AppState.currentState !== 'active') {
    lastAndroidNotificationBody = null;
    return;
  }

  try {
    await Location.startLocationUpdatesAsync(
      LOCATION_TASK_NAME,
      androidLocationOptions(notificationBody),
    );
  } catch {
    lastAndroidNotificationBody = null;
  }
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

  await updateAndroidIndicator(notificationBody);
  return null;
};

export const updateTrackingIndicator = async ({
  liveActivityId,
  session,
  segment,
  allSegments = [],
  snapshot,
  distanceUnit,
}: {
  liveActivityId: string | null;
  session: TrackingSessionRow;
  segment: TrackingSegmentRow | null;
  allSegments?: TrackingSegmentRow[];
  snapshot: Omit<IndicatorSnapshot, 'segmentLabel' | 'distanceUnit'>;
  distanceUnit: 'km' | 'mi';
}) => {
  await pushTrackingIndicator({
    liveActivityId,
    segmentLabel: resolveSegmentLabel(session, segment, allSegments),
    snapshot,
    distanceUnit,
  });
};

const pushTrackingIndicator = async ({
  liveActivityId,
  segmentLabel,
  snapshot,
  distanceUnit,
}: {
  liveActivityId: string | null;
  segmentLabel: string;
  snapshot: Omit<IndicatorSnapshot, 'segmentLabel' | 'distanceUnit'>;
  distanceUnit: 'km' | 'mi';
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
    await updateAndroidIndicator(notificationBody);
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
  lastAndroidNotificationBody = null;
  lastIndicatorPushAt = 0;
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

  const session = await getActiveTrackingSession();
  if (!session || session.ended_at || session.tracking_status === 'ended') return;

  // The location task keeps this current; recomputed here only if the task has gone quiet.
  const live = await readFreshLiveSnapshot(session.id);
  if (!live) return;
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
    },
    distanceUnit: resolveDistanceUnit(distanceUnit),
  });
};
