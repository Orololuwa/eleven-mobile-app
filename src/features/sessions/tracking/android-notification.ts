import { requireOptionalNativeModule } from 'expo';

type TrackingIndicatorNative = {
  updateNotification: (title: string, body: string, color: string) => Promise<boolean>;
};

const TrackingIndicator = requireOptionalNativeModule<TrackingIndicatorNative>('TrackingIndicator');

/** Updates the running expo-location FGS notification without restarting GPS. */
export const updateAndroidTrackingNotification = async ({
  title,
  body,
  color,
}: {
  title: string;
  body: string;
  color: string;
}) => {
  if (!TrackingIndicator) return false;
  try {
    return await TrackingIndicator.updateNotification(title, body, color);
  } catch {
    return false;
  }
};
