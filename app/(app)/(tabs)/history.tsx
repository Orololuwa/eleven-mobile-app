import { router } from 'expo-router';
import { HistoryScreen } from '@/screens';

export default function HistoryRoute() {
  return (
    <HistoryScreen
      sessions={[]}
      onSelectSession={(session) => {
        router.push(`/(app)/session/${session.id}`);
      }}
      onStartSession={() => router.push('/(app)/(tabs)')}
      onNavigateToHome={() => router.push('/(app)/(tabs)')}
      onNavigateToProfile={() => router.push('/(app)/(tabs)/profile')}
    />
  );
}
