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

/**
 * Amendment 03 C3: Android 10+ gates the step counter behind ACTIVITY_RECOGNITION. The location task
 * reads it natively; without the grant it never reports and sessions measure from GPS alone, so a
 * refusal is not a reason to stop the session.
 */
export const requestActivityRecognitionPermission = async () => {
  if (Platform.OS !== 'android') return true;
  if (typeof Platform.Version === 'number' && Platform.Version < 29) return true;

  try {
    const permission = PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION;
    if (await PermissionsAndroid.check(permission)) return true;
    const result = await PermissionsAndroid.request(permission);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    console.warn('[permissions] activity recognition request failed', error);
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
