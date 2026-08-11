import { router, useLocalSearchParams } from 'expo-router';
import { PitchSetupScreen } from '@/screens';

export default function PitchSetupRoute() {
  const { sessionType = 'match' } = useLocalSearchParams<{ sessionType?: string }>();

  const goToActiveSession = () => {
    router.replace({
      pathname: '/(app)/active-session',
      params: { sessionType },
    });
  };

  return (
    <PitchSetupScreen
      sessionType={sessionType}
      onComplete={goToActiveSession}
      onSkip={goToActiveSession}
    />
  );
}
