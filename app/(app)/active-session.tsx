import { useEffect } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Platform } from 'react-native';
import { ActiveSessionScreen } from '@/screens';
import { getActiveTrackingSession, initTrackingDb } from '@/features/sessions/tracking/db';
import { isLocationTaskRunning } from '@/features/sessions/tracking/location-task';
import { beginTrackingAfterPermission } from '@/features/sessions/tracking/session-lifecycle';
import { useAppStore } from '@/stores/app-store';

export default function ActiveSessionRoute() {
  const navigation = useNavigation();
  const { sessionType = 'match', sessionId = '' } = useLocalSearchParams<{
    sessionType?: string;
    sessionId?: string;
  }>();
  const units = useAppStore((s) => s.units);
  const distanceUnit = units.distance === 'mi' ? 'mi' : 'km';

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  useEffect(() => {
    void (async () => {
      await initTrackingDb();
      const active = await getActiveTrackingSession();
      if (active && !sessionId) {
        router.replace({
          pathname: '/(app)/active-session',
          params: { sessionType: active.session_type, sessionId: active.id },
        });
        return;
      }
      if (Platform.OS === 'android' && sessionId) {
        const running = await isLocationTaskRunning();
        if (!running) {
          await beginTrackingAfterPermission({
            backgroundPermission: 'when_in_use',
            distanceUnit,
          });
        }
      }
    })();
  }, [sessionId, distanceUnit]);

  return (
    <ActiveSessionScreen
      sessionType={sessionType}
      sessionId={sessionId}
      distanceUnit={distanceUnit}
      onEnd={() => {
        router.replace('/(app)/(tabs)');
      }}
    />
  );
}
