import React from 'react';
import { router } from 'expo-router';
import { SavedPitchesScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function SavedPitchesRoute() {
  const pitches = useAppStore((state) => state.savedPitches);
  const removeSavedPitch = useAppStore((state) => state.removeSavedPitch);

  return (
    <SavedPitchesScreen
      pitches={pitches}
      onBack={() => router.back()}
      onRemove={removeSavedPitch}
    />
  );
}
