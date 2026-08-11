import React from 'react';
import { router } from 'expo-router';
import { LinkConflictScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function LinkConflictRoute() {
  const sessionCount = useAppStore((state) => state.sessionCount);
  const signInMethods = useAppStore((state) => state.signInMethods);
  const signOut = useAppStore((state) => state.signOut);
  const setShowEmptyWallBanner = useAppStore((state) => state.setShowEmptyWallBanner);

  const currentMethodsLabel = signInMethods
    .filter((method) => method.connected)
    .map((method) => method.label.toUpperCase())
    .join(' · ');

  return (
    <LinkConflictScreen
      currentMethodsLabel={currentMethodsLabel || 'GOOGLE'}
      currentSessions={Math.max(sessionCount, 1)}
      otherSessions={6}
      onBack={() => router.back()}
      onKeepCurrent={() => router.back()}
      onSwitchAccount={() => {
        signOut();
        setShowEmptyWallBanner(true);
        router.replace('/(auth)/sign-in');
      }}
    />
  );
}
