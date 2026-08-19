import { router } from 'expo-router';
import { ProfileSetupScreen } from '@/screens';
import { completeLocalOnboarding } from '@/features/auth/use-auth-actions';

export default function ProfileSetupRoute() {
  const finish = async (data: Parameters<typeof completeLocalOnboarding>[0]) => {
    await completeLocalOnboarding(data);
    router.replace('/(app)/(tabs)');
  };

  return (
    <ProfileSetupScreen
      onComplete={(data) => {
        void finish(data);
      }}
      onSkip={() => {
        void finish({
          firstName: 'Player',
          position: 'MID',
          preferredFoot: 'LEFT',
        });
      }}
    />
  );
}
