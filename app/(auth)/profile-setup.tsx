import React, { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { ProfileSetupScreen } from '@/screens';
import { ApiError } from '@/lib/api-client';
import { usePositionPickerDraftStore } from '@/features/profile/position-picker-draft-store';
import { useUpdatePositionsMutation } from '@/features/profile/use-update-positions-mutation';
import { useUpdateProfileMutation } from '@/features/profile/use-update-profile-mutation';
import { useAppStore } from '@/stores/app-store';
import type { PositionIn, PreferredFoot } from '@/features/profile/types';
import { ensureOnePreferred } from '@/features/profile/validation';

export default function ProfileSetupRoute() {
  const draftPositions = usePositionPickerDraftStore((state) => state.positions);
  const positions = ensureOnePreferred(draftPositions);
  const displayName = usePositionPickerDraftStore((state) => state.displayName);
  const preferredFootIndex = usePositionPickerDraftStore((state) => state.preferredFootIndex);
  const setDisplayName = usePositionPickerDraftStore((state) => state.setDisplayName);
  const setPreferredFootIndex = usePositionPickerDraftStore((state) => state.setPreferredFootIndex);
  const resetPositions = usePositionPickerDraftStore((state) => state.reset);
  const setOnboardingCompleted = useAppStore((state) => state.setOnboardingCompleted);
  const updateProfile = useUpdateProfileMutation();
  const updatePositions = useUpdatePositionsMutation();
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(
    async ({
      display_name,
      preferred_foot,
      positions: nextPositions,
    }: {
      display_name: string;
      preferred_foot: PreferredFoot;
      positions: PositionIn[];
    }) => {
      setError(null);
      try {
        await updatePositions.mutateAsync(nextPositions);
        await updateProfile.mutateAsync({
          display_name,
          preferred_foot,
          onboarding_completed: true,
        });
        setOnboardingCompleted(true);
        resetPositions();
        router.replace('/(app)/(tabs)');
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : 'Could not complete setup');
      }
    },
    [resetPositions, setOnboardingCompleted, updatePositions, updateProfile],
  );

  const busy = updateProfile.isPending || updatePositions.isPending;

  return (
    <ProfileSetupScreen
      displayName={displayName}
      preferredFootIndex={preferredFootIndex}
      initialPositions={positions}
      busy={busy}
      error={error}
      onDisplayNameChange={setDisplayName}
      onPreferredFootIndexChange={setPreferredFootIndex}
      onComplete={(data) => {
        void finish(data);
      }}
      onOpenPositionPicker={() => router.push('/(auth)/position-picker')}
    />
  );
}
