import { useCallback } from 'react';
import { router } from 'expo-router';
import { EmailSignInScreen } from '@/screens';
import { errorMessage, isIdentityConflict } from '@/features/auth/errors';
import { linkEmailIdentity, requestEmailCode } from '@/features/auth/use-auth-actions';

export default function LinkEmailRoute() {
  const onSendCode = useCallback(({ email }: { email: string }) => requestEmailCode({ email }), []);
  const onVerifyCode = useCallback(async ({ email, code }: { email: string; code: string }) => {
    try {
      await linkEmailIdentity({ email, code });
      router.replace('/(app)/sign-in-methods');
    } catch (caught) {
      if (isIdentityConflict(caught)) {
        router.replace('/(app)/link-conflict');
        return;
      }
      throw new Error(errorMessage(caught));
    }
  }, []);

  return (
    <EmailSignInScreen
      onBack={() => router.back()}
      onSendCode={onSendCode}
      onVerifyCode={onVerifyCode}
    />
  );
}
