import { Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';
import { colors } from '@/theme';
import { formatDistance, formatElapsedLong, formatSpeed } from './live-metrics';
import type { TrackingSessionRow, TrackingSegmentRow } from './types';
import {
  isLocationTaskRunning,
  startLocationTracking,
  stopLocationTracking,
} from './location-task';

let lastAndroidNotificationBody: string | null = null;

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

const buildNotificationBody = ({
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

  return {
    title: `TRACKING · ${segmentLabel.toUpperCase()}`,
    subtitle: `${distance} ${distanceSuffix} · TOP ${speed} ${speedSuffix}`,
    progressBar: {
      elapsedTimer: {
        startDate: Date.now() - elapsedSeconds * 1000,
      },
    } as LiveActivity.LiveActivityState['progressBar'],
  };
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
  const segmentLabel = segment
    ? session.play_structure === 'halves'
      ? segment.segment_index === 1
        ? '1ST HALF'
        : '2ND HALF'
      : `SET ${segment.segment_index}`
    : 'SESSION';

  const fullSnapshot: IndicatorSnapshot = { ...snapshot, segmentLabel, distanceUnit };
  const notificationBody = buildNotificationBody(fullSnapshot);

  if (Platform.OS === 'ios') {
    const state = buildLiveActivityState(fullSnapshot);
    const activityId = LiveActivity.startActivity(state, liveActivityConfig);
    return activityId ?? null;
  }

  lastAndroidNotificationBody = notificationBody;
  await startLocationTracking({ notificationBody });
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
  const segmentLabel = segment
    ? session.play_structure === 'halves'
      ? segment.segment_index === 1
        ? '1ST HALF'
        : '2ND HALF'
      : `SET ${segment.segment_index}`
    : 'SESSION';

  const fullSnapshot: IndicatorSnapshot = { ...snapshot, segmentLabel, distanceUnit };
  const notificationBody = buildNotificationBody(fullSnapshot);

  if (Platform.OS === 'ios' && liveActivityId) {
    LiveActivity.updateActivity(liveActivityId, buildLiveActivityState(fullSnapshot));
    return;
  }

  if (Platform.OS === 'android') {
    if (notificationBody === lastAndroidNotificationBody) return;
    lastAndroidNotificationBody = notificationBody;
    const running = await isLocationTaskRunning();
    if (running) {
      await stopLocationTracking();
    }
    await startLocationTracking({ notificationBody });
  }
};

export const stopTrackingIndicator = async (liveActivityId: string | null) => {
  if (Platform.OS === 'ios' && liveActivityId) {
    LiveActivity.stopActivity(liveActivityId, { title: 'Session ended', progressBar: {} });
  }
  lastAndroidNotificationBody = null;
  await stopLocationTracking();
};

export { buildNotificationBody };
