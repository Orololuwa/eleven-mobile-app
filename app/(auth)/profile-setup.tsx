import { router } from 'expo-router';
import { ProfileSetupScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function ProfileSetupRoute() {
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

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
