import { Redirect, Stack, useSegments } from 'expo-router';
import { AuthLoadingScreen } from '@/screens';
import { colors } from '@/theme';
import {
  selectHasCompletedOnboarding,
  selectIsAuthenticated,
  useAppStore,
} from '@/stores/app-store';

export default function AuthLayout() {
  const authStatus = useAppStore((state) => state.authStatus);
  const isAuthenticated = useAppStore(selectIsAuthenticated);
  const hasCompletedOnboarding = useAppStore(selectHasCompletedOnboarding);
  const segments = useSegments();
  const onOnboardingFlow =
    segments.includes('profile-setup') || segments.includes('position-picker');

  if (authStatus === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated && hasCompletedOnboarding) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  if (isAuthenticated && !hasCompletedOnboarding && !onOnboardingFlow) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  if (!isAuthenticated && onOnboardingFlow) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    />
  );
}
