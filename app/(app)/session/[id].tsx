import { router } from 'expo-router';
import { SessionDetailScreen } from '@/screens';

export default function SessionDetailRoute() {
  return (
    <SessionDetailScreen
      sessionData={{
        title: 'SUNDAY MATCH',
        date: '09 AUG · LEKKI ASTRO · 94 MIN',
        location: 'Lekki Astro',
        duration: 94,
        distance: 8.4,
        topSpeed: 31.2,
        sprints: 28,
        calories: 842,
        longestSprint: 42,
        sprintDistance: 0.9,
        recoveryTime: 48,
        hasHeatmap: true,
      }}
      onBack={() => router.back()}
      onShare={() => {}}
      onNavigateToHome={() => router.replace('/(app)/(tabs)')}
    />
  );
}
