import { requireOptionalNativeModule } from 'expo';

type TrackingIndicatorNative = {
  updateNotification: (
    title: string,
    body: string,
    color: string,
    chronometerBaseMs: number | null,
  ) => Promise<boolean>;
  /** Absent on binaries built before 4 Nov 2026. */
  dismissNotification?: () => Promise<number>;
};

const TrackingIndicator = requireOptionalNativeModule<TrackingIndicatorNative>('TrackingIndicator');

/** Updates the running expo-location FGS notification without restarting GPS. */
export const updateAndroidTrackingNotification = async ({
  title,
  body,
  color,
  chronometerBaseMs = null,
}: {
  title: string;
  body: string;
  color: string;
  /** Running clock origin; the system ticks it. Null while paused. */
  chronometerBaseMs?: number | null;
}) => {
  if (!TrackingIndicator) return false;
  try {
    return await TrackingIndicator.updateNotification(title, body, color, chronometerBaseMs);
  } catch {
    return false;
  }
};

/** Clears any tracking notification left behind after the FGS stopped. Returns how many. */
export const dismissAndroidTrackingNotification = async () => {
  if (!TrackingIndicator?.dismissNotification) return 0;
  try {
    return await TrackingIndicator.dismissNotification();
  } catch {
    return 0;
  }
};
