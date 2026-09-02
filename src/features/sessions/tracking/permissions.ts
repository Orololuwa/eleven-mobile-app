import { Platform } from 'react-native';
import * as Location from 'expo-location';

export type TrackingPermissionResult = {
  foregroundGranted: boolean;
  background: 'always' | 'when_in_use' | 'denied';
};

export const requestTrackingPermissions = async ({
  requestBackground = true,
}: { requestBackground?: boolean } = {}): Promise<TrackingPermissionResult> => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return { foregroundGranted: false, background: 'denied' };
  }

  if (Platform.OS === 'android') {
    return { foregroundGranted: true, background: 'when_in_use' };
  }

  if (!requestBackground) {
    return { foregroundGranted: true, background: 'when_in_use' };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.granted) {
    return { foregroundGranted: true, background: 'always' };
  }

  return { foregroundGranted: true, background: 'when_in_use' };
};

export const hasBackgroundAlways = async () => {
  const status = await Location.getBackgroundPermissionsAsync();
  return status.granted;
};

export const getForegroundPermissionStatus = async () => {
  const status = await Location.getForegroundPermissionsAsync();
  return status.granted;
};
