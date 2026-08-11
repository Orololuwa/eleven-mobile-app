import { router } from 'expo-router';
import { SignInScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function SignInRoute() {
  const setShowEmptyWallBanner = useAppStore((state) => state.setShowEmptyWallBanner);

  return (
    <SignInScreen
      onContinueWithApple={() => {
        // 01H — Apple can land on an empty wall; offer recovery after setup
        setShowEmptyWallBanner(true);
        router.push('/(auth)/profile-setup');
      }}
      onContinueWithGoogle={() => {
        setShowEmptyWallBanner(false);
        router.push('/(auth)/profile-setup');
      }}
      onUseEmail={() => {
        setShowEmptyWallBanner(false);
        router.push('/(auth)/email-sign-in');
      }}
    />
  );
}
