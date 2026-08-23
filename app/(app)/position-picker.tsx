import React from 'react';
import { router } from 'expo-router';
import { PositionPickerScreen } from '@/screens';
import { usePositionPickerDraftStore } from '@/features/profile/position-picker-draft-store';
import { useMyProfileQuery } from '@/features/profile/use-profile-query';

export default function AppPositionPickerRoute() {
  const draftPositions = usePositionPickerDraftStore((state) => state.positions);
  const setDraftPositions = usePositionPickerDraftStore((state) => state.setPositions);
  const { data: profile } = useMyProfileQuery();

  const initialPositions = draftPositions.length > 0 ? draftPositions : (profile?.positions ?? []);

  return (
    <PositionPickerScreen
      initialPositions={initialPositions}
      onCancel={() => router.back()}
      onSave={(positions) => {
        setDraftPositions(positions);
        router.back();
      }}
    />
  );
}
