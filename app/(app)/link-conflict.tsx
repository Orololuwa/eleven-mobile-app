import React from 'react';
import { router } from 'expo-router';
import { LinkConflictScreen } from '@/screens';
import { errorMessage, isUserCancelled } from '@/features/auth/errors';
import { routeAfterAuth } from '@/features/auth/routes';
import { signInWithApple, signOut } from '@/features/auth/use-auth-actions';
import { useAppStore } from '@/stores/app-store';

export default function LinkConflictRoute() {
  const sessionCount = useAppStore((state) => state.sessionCount);
  const signInMethods = useAppStore((state) => state.signInMethods);

  const currentMethodsLabel = signInMethods
    .filter((method) => method.connected)
    .map((method) => method.label.toUpperCase())
    .join(' · ');

  return (
    <LinkConflictScreen
      currentMethodsLabel={currentMethodsLabel || 'GOOGLE'}
      currentSessions={Math.max(sessionCount, 1)}
      otherSessions={0}
      onBack={() => router.back()}
      onKeepCurrent={() => router.back()}
      onSwitchAccount={() => {
        void (async () => {
          try {
            await signOut();
            await signInWithApple();
            router.replace(routeAfterAuth());
          } catch (caught) {
            if (isUserCancelled(caught)) {
              router.replace('/(auth)/sign-in');
              return;
            }
            router.replace('/(auth)/sign-in');
            console.warn(errorMessage(caught));
          }
        })();
      }}
    />
  );
}
