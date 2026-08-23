import React, { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { ProfileSetupScreen } from '@/screens';
import { ApiError } from '@/lib/api-client';
import { usePositionPickerDraftStore } from '@/features/profile/position-picker-draft-store';
import { useUpdatePositionsMutation } from '@/features/profile/use-update-positions-mutation';
import { useUpdateProfileMutation } from '@/features/profile/use-update-profile-mutation';
import { useAppStore } from '@/stores/app-store';
import type { PositionIn, PreferredFoot } from '@/features/profile/types';

const defaultSkipPayload = {
  display_name: 'X',
  preferred_foot: 'right' as PreferredFoot,
  positions: [{ position: 'CM' as const, is_preferred: true }],
};

export default function ProfileSetupRoute() {
  const positions = usePositionPickerDraftStore((state) => state.positions);
  const setPositions = usePositionPickerDraftStore((state) => state.setPositions);
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
        await updateProfile.mutateAsync({
          display_name,
          preferred_foot,
          onboarding_completed: true,
        });
        await updatePositions.mutateAsync(nextPositions);
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
      initialPositions={positions}
      busy={busy}
      error={error}
      onComplete={(data) => {
        void finish(data);
      }}
      onSkip={() => {
        setPositions(defaultSkipPayload.positions);
        void finish(defaultSkipPayload);
      }}
      onOpenPositionPicker={() => router.push('/(auth)/position-picker')}
    />
  );
}
