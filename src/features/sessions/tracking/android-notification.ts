import { requireOptionalNativeModule } from 'expo';

type TrackingIndicatorNative = {
  updateNotification: (
    title: string,
    body: string,
    color: string,
    chronometerBaseMs: number | null,
  ) => Promise<boolean>;
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
