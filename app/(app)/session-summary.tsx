import { router, useLocalSearchParams } from 'expo-router';
import { SessionSummaryScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function SessionSummaryRoute() {
  const { sessionType = 'match' } = useLocalSearchParams<{ sessionType?: string }>();
  const sessionCount = useAppStore((state) => state.sessionCount);
  const incrementSessionCount = useAppStore((state) => state.incrementSessionCount);

  const sessionData = {
    title: 'Sunday Match',
    date: '09 AUG 2026',
    location: 'Lekki',
    type: sessionType.toUpperCase(),
    brickNumber: sessionCount + 1,
    distance: 8.4,
    topSpeed: 31.2,
    sprints: 28,
    calories: 842,
    duration: 94,
    isNewRecord: true,
  };

  return (
    <SessionSummaryScreen
      sessionData={sessionData}
      totalBricks={sessionCount + 1}
      onShare={() => {}}
      onDone={() => {
        incrementSessionCount();
        router.replace('/(app)/(tabs)');
      }}
    />
  );
}
