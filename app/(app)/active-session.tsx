import { useEffect } from 'react';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { ActiveSessionScreen } from '@/screens';
import { getActiveTrackingSession, initTrackingDb } from '@/features/sessions/tracking/db';
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
      }
    })();
  }, [sessionId]);

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
