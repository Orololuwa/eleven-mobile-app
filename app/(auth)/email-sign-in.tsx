import { useCallback } from 'react';
import { router } from 'expo-router';
import { EmailSignInScreen } from '@/screens';
import { routeAfterAuth } from '@/features/auth/routes';
import { requestEmailCode, verifyEmailCode } from '@/features/auth/use-auth-actions';

export default function EmailSignInRoute() {
  const onSendCode = useCallback(({ email }: { email: string }) => requestEmailCode({ email }), []);
  const onVerifyCode = useCallback(async ({ email, code }: { email: string; code: string }) => {
    await verifyEmailCode({ email, code });
    router.replace(routeAfterAuth());
  }, []);

  return (
    <EmailSignInScreen
      onBack={() => router.back()}
      onSendCode={onSendCode}
      onVerifyCode={onVerifyCode}
    />
  );
}
