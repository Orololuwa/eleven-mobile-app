import { useCallback, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { ActiveSessionScreen } from '@/screens';
import { useMyProfileQuery } from '@/features/profile/use-profile-query';
import {
  getActiveTrackingSession,
  getTrackingSession,
  initTrackingDb,
} from '@/features/sessions/tracking/db';
import { useAppStore } from '@/stores/app-store';

export default function ActiveSessionRoute() {
  const navigation = useNavigation();
  const { sessionType = 'match', sessionId = '' } = useLocalSearchParams<{
    sessionType?: string;
    sessionId?: string;
  }>();
  const units = useAppStore((s) => s.units);
  const distanceUnit = units.distance === 'mi' ? 'mi' : 'km';
  const profile = useMyProfileQuery();
  const massKg = profile.data?.weight_kg ?? null;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  // Android back would pop the HUD with the session still running — and the next kickoff left it
  // open for good (3 Nov run). While it is unfinished, back stays here; End is the way out.
  useFocusEffect(
    useCallback(() => {
      let unfinished = true;
      void getTrackingSession(sessionId).then((row) => {
        unfinished = row != null && row.ended_at == null;
      });
      const sub = BackHandler.addEventListener('hardwareBackPress', () => unfinished);
      return () => sub.remove();
    }, [sessionId]),
  );

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
      massKg={massKg}
      onEnd={() => {
        router.replace({
          pathname: '/(app)/session-summary',
          params: { sessionId },
        });
      }}
    />
  );
}
