import React from 'react';
import { router } from 'expo-router';
import { SignInMethodsScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function SignInMethodsRoute() {
  const methods = useAppStore((state) => state.signInMethods);
  const updateSignInMethod = useAppStore((state) => state.updateSignInMethod);
  const signOut = useAppStore((state) => state.signOut);

  const connectedCount = methods.filter((method) => method.connected).length;

  return (
    <SignInMethodsScreen
      methods={methods}
      onBack={() => router.back()}
      onAdd={(id) => {
        if (id === 'apple') {
          // Demo: Apple already owns another wall → conflict screen (01F)
          router.push('/(app)/link-conflict');
          return;
        }
        updateSignInMethod(id, {
          connected: true,
          email: 'emmanuel.a@gmail.com',
          since: 'TODAY',
        });
      }}
      onRemove={(id) => {
        if (connectedCount <= 1) return;
        updateSignInMethod(id, { connected: false, email: undefined, since: undefined });
      }}
      onSignOut={() => {
        signOut();
        router.replace('/(auth)/sign-in');
      }}
    />
  );
}
