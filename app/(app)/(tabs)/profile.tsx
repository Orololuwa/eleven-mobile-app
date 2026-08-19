import React from 'react';
import { router } from 'expo-router';
import { ProfileScreen } from '@/screens';
import { signOut } from '@/features/auth/use-auth-actions';
import { useAppStore } from '@/stores/app-store';

export default function ProfileRoute() {
  const user = useAppStore((state) => state.user);
  const sessionCount = useAppStore((state) => state.sessionCount);
  const units = useAppStore((state) => state.units);
  const signInMethods = useAppStore((state) => state.signInMethods);
  const savedPitches = useAppStore((state) => state.savedPitches);

  const signInSummary = signInMethods
    .filter((method) => method.connected)
    .map((method) => method.label.toUpperCase())
    .join(' · ');

  const totalKm = sessionCount > 0 ? Math.round(sessionCount * 5.9) : 0;
  const totalHours = sessionCount > 0 ? Math.round(sessionCount * 1.35) : 0;

  return (
    <ProfileScreen
      user={user}
      sessionCount={sessionCount}
      totalKm={totalKm}
      totalHours={totalHours}
      units={units}
      signInSummary={signInSummary || 'NONE'}
      savedPitchCount={savedPitches.length}
      onNavigateToHome={() => router.push('/(app)/(tabs)')}
      onNavigateToHistory={() => router.push('/(app)/(tabs)/history')}
      onPlayerDetails={() => router.push('/(app)/player-details')}
      onSignInMethods={() => router.push('/(app)/sign-in-methods')}
      onUnits={() => router.push('/(app)/units')}
      onSavedPitches={() => router.push('/(app)/saved-pitches')}
      onPrivacyData={() => router.push('/(app)/privacy-data')}
      onSignOut={() => {
        void signOut().then(() => router.replace('/(auth)/sign-in'));
      }}
    />
  );
}
