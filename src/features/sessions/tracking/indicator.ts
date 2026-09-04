import { AppState, Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';
import * as Location from 'expo-location';
import { colors } from '@/theme';
import { useAppStore } from '@/stores/app-store';
import { updateAndroidTrackingNotification } from './android-notification';
import { ANDROID_FGS_TITLE, INDICATOR_UPDATE_INTERVAL_MS, LOCATION_TASK_NAME } from './constants';
import {
  getActiveTrackingSession,
  getCurrentSegment,
  getPausesForSegment,
  getPausesForSession,
  getPointsForSegment,
  getPointsForSession,
} from './db';
import {
  computeLiveMetrics,
  elapsedSecondsFromPauses,
  formatDistance,
  formatElapsedLong,
  formatSpeed,
} from './live-metrics';
import type { TrackingSegmentRow, TrackingSessionRow } from './types';

let lastAndroidNotificationBody: string | null = null;
let lastDistanceUnit: 'km' | 'mi' = 'km';
let lastIndicatorPushAt = 0;

type IndicatorSnapshot = {
  elapsedSeconds: number;
  distanceKm: number;
  topSpeedKmh: number;
  segmentLabel: string;
  distanceUnit: 'km' | 'mi';
};

const liveActivityConfig: LiveActivity.LiveActivityConfig = {
  backgroundColor: colors.background.secondary,
  titleColor: colors.text.primary,
  subtitleColor: colors.brand.primary,
  progressViewTint: colors.brand.primary,
  progressViewLabelColor: colors.text.primary,
  deepLinkUrl: '/active-session',
  timerType: 'digital',
};

const segmentLabelFor = (
  session: TrackingSessionRow,
  segment: TrackingSegmentRow | null,
): string => {
  if (session.play_structure === 'open') return session.session_type.toUpperCase();
  if (!segment) return 'SESSION';
  if (session.play_structure === 'halves') {
    return segment.segment_index === 1 ? '1ST HALF' : '2ND HALF';
  }
  return `SET ${segment.segment_index}`;
};

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

export const buildNotificationBody = ({
  elapsedSeconds,
  distanceKm,
  topSpeedKmh,
  distanceUnit,
}: Omit<IndicatorSnapshot, 'segmentLabel'>) => {
  const elapsed = formatElapsedLong(elapsedSeconds);
  const distance = formatDistance({ km: distanceKm, unit: distanceUnit });
  const speed = formatSpeed({ kmh: topSpeedKmh, unit: distanceUnit });
  const distanceSuffix = distanceUnit === 'mi' ? 'MI' : 'KM';
  const speedSuffix = distanceUnit === 'mi' ? 'MPH' : 'KM/H';
  return `${elapsed} · ${distance} ${distanceSuffix} · TOP ${speed} ${speedSuffix}`;
};

const buildLiveActivityState = ({
  segmentLabel,
  elapsedSeconds,
  distanceKm,
  topSpeedKmh,
  distanceUnit,
}: IndicatorSnapshot): LiveActivity.LiveActivityState => {
  const distance = formatDistance({ km: distanceKm, unit: distanceUnit });
  const speed = formatSpeed({ kmh: topSpeedKmh, unit: distanceUnit });
  const distanceSuffix = distanceUnit === 'mi' ? 'MI' : 'KM';
  const speedSuffix = distanceUnit === 'mi' ? 'MPH' : 'KM/H';
  const elapsed = formatElapsedLong(elapsedSeconds);

  return {
    title: `TRACKING · ${segmentLabel.toUpperCase()}`,
    subtitle: `${elapsed} · ${distance} ${distanceSuffix} · TOP ${speed} ${speedSuffix}`,
  };
};

const androidLocationOptions = (notificationBody: string): Location.LocationTaskOptions => ({
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: ANDROID_FGS_TITLE,
    notificationBody,
    notificationColor: colors.brand.primary,
  },
});

const updateAndroidIndicator = async (notificationBody: string) => {
  if (notificationBody === lastAndroidNotificationBody) return;
  lastAndroidNotificationBody = notificationBody;

  const updatedInPlace = await updateAndroidTrackingNotification({
    title: ANDROID_FGS_TITLE,
    body: notificationBody,
    color: colors.brand.primary,
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
  snapshot,
  distanceUnit,
}: {
  session: TrackingSessionRow;
  segment: TrackingSegmentRow | null;
  snapshot: Omit<IndicatorSnapshot, 'segmentLabel' | 'distanceUnit'>;
  distanceUnit: 'km' | 'mi';
}) => {
  const unit = resolveDistanceUnit(distanceUnit);
  const fullSnapshot: IndicatorSnapshot = {
    ...snapshot,
    segmentLabel: segmentLabelFor(session, segment),
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
  snapshot,
  distanceUnit,
}: {
  liveActivityId: string | null;
  session: TrackingSessionRow;
  segment: TrackingSegmentRow | null;
  snapshot: Omit<IndicatorSnapshot, 'segmentLabel' | 'distanceUnit'>;
  distanceUnit: 'km' | 'mi';
}) => {
  const unit = resolveDistanceUnit(distanceUnit);
  const fullSnapshot: IndicatorSnapshot = {
    ...snapshot,
    segmentLabel: segmentLabelFor(session, segment),
    distanceUnit: unit,
  };
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

  const unit = resolveDistanceUnit(distanceUnit);
  const segment = await getCurrentSegment(session.id);
  const segmentId = segment?.id ?? null;
  const points = segmentId
    ? await getPointsForSegment(segmentId)
    : await getPointsForSession(session.id);
  const pauses = segmentId
    ? await getPausesForSegment(segmentId)
    : (await getPausesForSession(session.id)).filter((pause) => pause.segment_id == null);

  const metrics = computeLiveMetrics({ points, pausedRanges: pauses });
  const startedAt = segment?.started_at ?? session.started_at;
  const elapsedSeconds = elapsedSecondsFromPauses({ startedAt, pausedRanges: pauses });

  lastIndicatorPushAt = now;
  await updateTrackingIndicator({
    liveActivityId: session.live_activity_id,
    session,
    segment,
    snapshot: {
      elapsedSeconds,
      distanceKm: metrics.distanceKm,
      topSpeedKmh: metrics.topSpeedKmh,
    },
    distanceUnit: unit,
  });
};
