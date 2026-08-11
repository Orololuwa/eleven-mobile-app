import { router } from 'expo-router';
import { SignInScreen } from '@/screens';

export default function SignInRoute() {
  return (
    <SignInScreen
      onContinueWithApple={() => router.push('/(auth)/profile-setup')}
      onContinueWithGoogle={() => router.push('/(auth)/profile-setup')}
      onUseEmail={() => router.push('/(auth)/email-sign-in')}
    />
  );
}
