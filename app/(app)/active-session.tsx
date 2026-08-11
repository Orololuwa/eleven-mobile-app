import { router, useLocalSearchParams } from 'expo-router';
import { ActiveSessionScreen } from '@/screens';

export default function ActiveSessionRoute() {
  const { sessionType = 'match' } = useLocalSearchParams<{ sessionType?: string }>();

  return (
    <ActiveSessionScreen
      sessionType={sessionType}
      onPause={() => {}}
      onEnd={() => {
        router.replace({
          pathname: '/(app)/session-summary',
          params: { sessionType },
        });
      }}
    />
  );
}
