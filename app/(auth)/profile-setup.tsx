import { router } from 'expo-router';
import { ProfileSetupScreen } from '@/screens';
import { useApp } from '@/providers/app-provider';

export default function ProfileSetupRoute() {
  const { completeOnboarding } = useApp();

  return (
    <ProfileSetupScreen
      onComplete={(data) => {
        completeOnboarding(data);
        router.replace('/(app)/(tabs)');
      }}
      onSkip={() => {
        completeOnboarding({
          firstName: 'Player',
          position: 'MID',
          preferredFoot: 'LEFT',
        });
        router.replace('/(app)/(tabs)');
      }}
    />
  );
}
