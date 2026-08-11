import React from 'react';
import { router } from 'expo-router';
import { PlayerDetailsScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function PlayerDetailsRoute() {
  const user = useAppStore((state) => state.user);
  const units = useAppStore((state) => state.units);
  const updateUser = useAppStore((state) => state.updateUser);

  if (!user) {
    router.replace('/(auth)/sign-in');
    return null;
  }

  return (
    <PlayerDetailsScreen
      user={user}
      units={units}
      onCancel={() => router.back()}
      onSave={(data) => {
        updateUser(data);
        router.back();
      }}
    />
  );
}
