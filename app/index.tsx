import { Redirect } from 'expo-router';
import { selectIsAuthenticated, useAppStore } from '@/stores/app-store';

export default function Index() {
  const isAuthenticated = useAppStore(selectIsAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
