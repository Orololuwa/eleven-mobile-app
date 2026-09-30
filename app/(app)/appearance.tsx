import React from 'react';
import { router } from 'expo-router';
import { AppearanceScreen } from '@/screens';
import { useAppearanceStore } from '@/stores/appearance-store';
import { useResolvedColorScheme } from '@/theme';

export default function AppearanceRoute() {
  const preference = useAppearanceStore((state) => state.preference);
  const setPreference = useAppearanceStore((state) => state.setPreference);
  const activeScheme = useResolvedColorScheme();

  return (
    <AppearanceScreen
      preference={preference}
      activeScheme={activeScheme}
      onBack={() => router.back()}
      onChange={setPreference}
    />
  );
}
