import { router, useLocalSearchParams } from 'expo-router';
import { ActiveSessionScreen } from '@/screens';

export default function ActiveSessionRoute() {
  const { sessionType = 'match', sessionId } = useLocalSearchParams<{
    sessionType?: string;
    sessionId?: string;
  }>();

  return (
    <ActiveSessionScreen
      sessionType={sessionType}
      sessionId={sessionId}
      onPause={() => {}}
      onEnd={() => {
        router.replace({
          pathname: '/(app)/session-summary',
          params: { sessionType, ...(sessionId ? { sessionId } : {}) },
        });
      }}
    />
  );
}
