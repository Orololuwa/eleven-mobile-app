import { useEffect } from 'react';
import { Redirect, Stack, router } from 'expo-router';
import { AuthLoadingScreen } from '@/screens';
import { colors } from '@/theme';
import { selectIsAuthenticated, useAppStore } from '@/stores/app-store';
import { getActiveTrackingSession, initTrackingDb } from '@/features/sessions/tracking/db';

export default function AppLayout() {
  const authStatus = useAppStore((state) => state.authStatus);
  const isAuthenticated = useAppStore(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    void (async () => {
      await initTrackingDb();
      const active = await getActiveTrackingSession();
      if (active) {
        router.replace({
          pathname: '/(app)/active-session',
          params: { sessionType: active.session_type, sessionId: active.id },
        });
      }
    })();
  }, [isAuthenticated]);

  if (authStatus === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="play-structure" />
      <Stack.Screen name="pitch-setup" />
      <Stack.Screen name="select-saved-pitch" />
      <Stack.Screen
        name="active-session"
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="session-summary" />
      <Stack.Screen name="session/[id]" />
      <Stack.Screen name="player-details" />
      <Stack.Screen name="position-picker" />
      <Stack.Screen name="sign-in-methods" />
      <Stack.Screen name="link-email" />
      <Stack.Screen name="units" />
      <Stack.Screen name="saved-pitches" />
      <Stack.Screen name="privacy-data" />
      <Stack.Screen name="link-conflict" />
      <Stack.Screen
        name="find-wall"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
