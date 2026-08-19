import { Redirect } from 'expo-router';
import { AuthLoadingScreen } from '@/screens';
import {
  selectHasCompletedOnboarding,
  selectIsAuthenticated,
  useAppStore,
} from '@/stores/app-store';

export default function Index() {
  const authStatus = useAppStore((state) => state.authStatus);
  const isAuthenticated = useAppStore(selectIsAuthenticated);
  const hasCompletedOnboarding = useAppStore(selectHasCompletedOnboarding);

  if (authStatus === 'loading') {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  return <Redirect href="/(app)/(tabs)" />;
}
