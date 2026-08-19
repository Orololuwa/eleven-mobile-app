import { useState } from 'react';
import { router } from 'expo-router';
import { SignInScreen } from '@/screens';
import { errorMessage, isUserCancelled } from '@/features/auth/errors';
import { routeAfterAuth } from '@/features/auth/routes';
import { signInWithApple, signInWithGoogle } from '@/features/auth/use-auth-actions';

type BusyProvider = 'apple' | 'google' | null;

export default function SignInRoute() {
  const [busyProvider, setBusyProvider] = useState<BusyProvider>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async ({
    provider,
    run,
  }: {
    provider: Exclude<BusyProvider, null>;
    run: () => Promise<unknown>;
  }) => {
    if (busyProvider) return;
    setError(null);
    setBusyProvider(provider);
    try {
      await run();
      router.replace(routeAfterAuth());
    } catch (caught) {
      if (!isUserCancelled(caught)) setError(errorMessage(caught));
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <SignInScreen
      busyProvider={busyProvider}
      errorMessage={error}
      onContinueWithApple={() => signIn({ provider: 'apple', run: signInWithApple })}
      onContinueWithGoogle={() => signIn({ provider: 'google', run: signInWithGoogle })}
      onUseEmail={() => router.push('/(auth)/email-sign-in')}
    />
  );
}
