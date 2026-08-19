import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SignInMethodsScreen } from '@/screens';
import { errorMessage, isIdentityConflict, isUserCancelled } from '@/features/auth/errors';
import { linkProvider, signOut } from '@/features/auth/use-auth-actions';
import { useAppStore } from '@/stores/app-store';
import type { SignInMethodId } from '@/types/profile';

export default function SignInMethodsRoute() {
  const methods = useAppStore((state) => state.signInMethods);
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAddRef = useRef(false);
  const busyRef = useRef(false);

  const handleAdd = useCallback(async (id: SignInMethodId) => {
    if (id === 'email') {
      router.push('/(app)/link-email');
      return;
    }
    if (busyRef.current) return;

    setError(null);
    busyRef.current = true;
    setBusy(true);
    try {
      await linkProvider(id);
    } catch (caught) {
      if (isUserCancelled(caught)) return;
      if (isIdentityConflict(caught)) {
        router.push('/(app)/link-conflict');
        return;
      }
      setError(errorMessage(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (autoAddRef.current) return;
    if (add !== 'apple' && add !== 'google' && add !== 'email') return;
    autoAddRef.current = true;
    void handleAdd(add);
  }, [add, handleAdd]);

  return (
    <SignInMethodsScreen
      methods={methods}
      busy={busy}
      errorMessage={error}
      canRemove={false}
      onBack={() => router.back()}
      onAdd={(id) => {
        void handleAdd(id);
      }}
      onRemove={() => {}}
      onSignOut={() => {
        void signOut().then(() => router.replace('/(auth)/sign-in'));
      }}
    />
  );
}
