import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';

export type TrackingPermissionResult = {
  foregroundGranted: boolean;
  background: 'always' | 'when_in_use' | 'denied';
  notificationsGranted: boolean;
};

/** Android 13+ needs POST_NOTIFICATIONS or the FGS tracking HUD stays hidden. */
const requestAndroidNotificationPermission = async () => {
  if (Platform.OS !== 'android') return true;
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return true;

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('[permissions] notification request failed', error);
    return false;
  }
};

export const requestTrackingPermissions = async ({
  requestBackground = true,
}: { requestBackground?: boolean } = {}): Promise<TrackingPermissionResult> => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return { foregroundGranted: false, background: 'denied', notificationsGranted: false };
  }

  const notificationsGranted = await requestAndroidNotificationPermission();

  if (Platform.OS === 'android') {
    return { foregroundGranted: true, background: 'when_in_use', notificationsGranted };
  }

  if (!requestBackground) {
    return { foregroundGranted: true, background: 'when_in_use', notificationsGranted: true };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.granted) {
    return { foregroundGranted: true, background: 'always', notificationsGranted: true };
  }

  return { foregroundGranted: true, background: 'when_in_use', notificationsGranted: true };
};

export const hasBackgroundAlways = async () => {
  const status = await Location.getBackgroundPermissionsAsync();
  return status.granted;
};

export const getForegroundPermissionStatus = async () => {
  const status = await Location.getForegroundPermissionsAsync();
  return status.granted;
};
