import { router } from 'expo-router';
import { EmailSignInScreen } from '@/screens';

export default function EmailSignInRoute() {
  return (
    <EmailSignInScreen
      onBack={() => router.back()}
      onVerified={() => router.replace('/(auth)/profile-setup')}
    />
  );
}
