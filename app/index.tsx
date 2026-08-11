import { Redirect } from 'expo-router';
import { useApp } from '@/providers/app-provider';

export default function Index() {
  const { isAuthenticated } = useApp();

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
