import React, { useState } from 'react';
import { router } from 'expo-router';
import { PlayerDetailsScreen } from '@/screens';
import { ApiError } from '@/lib/api-client';
import { usePositionPickerDraftStore } from '@/features/profile/position-picker-draft-store';
import { useMyProfileQuery } from '@/features/profile/use-profile-query';
import { useDeleteAvatarMutation } from '@/features/profile/use-delete-avatar-mutation';
import { useUpdatePositionsMutation } from '@/features/profile/use-update-positions-mutation';
import { useUpdateProfileMutation } from '@/features/profile/use-update-profile-mutation';
import { useUploadAvatarMutation } from '@/features/profile/use-upload-avatar-mutation';
import { useAppStore } from '@/stores/app-store';
import type { PositionIn, ProfileUpdate } from '@/features/profile/types';
import { validatePositionSet } from '@/features/profile/validation';

export default function PlayerDetailsRoute() {
  const units = useAppStore((state) => state.units);
  const { data: profile, isLoading } = useMyProfileQuery();
  const draftPositions = usePositionPickerDraftStore((state) => state.positions);
  const resetDraftPositions = usePositionPickerDraftStore((state) => state.reset);
  const updateProfile = useUpdateProfileMutation();
  const updatePositions = useUpdatePositionsMutation();
  const uploadAvatar = useUploadAvatarMutation();
  const deleteAvatar = useDeleteAvatarMutation();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (isLoading || !profile) {
    return null;
  }

  const positionsChanged =
    draftPositions.length > 0 &&
    JSON.stringify(draftPositions) !== JSON.stringify(profile.positions);

  const handleSave = async (update: ProfileUpdate, positions: PositionIn[]) => {
    setError(null);
    setFieldErrors({});
    const positionError = validatePositionSet(positions);
    if (positionError) {
      setError(positionError);
      return;
    }

    try {
      if (positionsChanged) {
        await updatePositions.mutateAsync(positions);
      }
      await updateProfile.mutateAsync(update);
      resetDraftPositions();
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setError(Object.keys(err.fieldErrors).length > 0 ? null : err.detail);
        return;
      }
      setError('Could not save profile');
    }
  };

  const busy = updateProfile.isPending || updatePositions.isPending;

  return (
    <PlayerDetailsScreen
      profile={profile}
      draftPositions={draftPositions}
      units={units}
      busy={busy}
      avatarBusy={uploadAvatar.isPending || deleteAvatar.isPending}
      error={error}
      fieldErrors={fieldErrors}
      onCancel={() => {
        resetDraftPositions();
        router.back();
      }}
      onSave={(update, positions) => {
        void handleSave(update, positions);
      }}
      onOpenPositionPicker={() =>
        router.push({
          pathname: '/(app)/position-picker',
        })
      }
      onUploadAvatar={(uri) => {
        setError(null);
        setFieldErrors({});
        uploadAvatar.mutate(uri, {
          onError: (err) => {
            setError(err instanceof ApiError ? err.detail : 'Could not upload avatar');
          },
        });
      }}
      onRemoveAvatar={() => {
        setError(null);
        setFieldErrors({});
        deleteAvatar.mutate(undefined, {
          onError: (err) => {
            setError(err instanceof ApiError ? err.detail : 'Could not remove avatar');
          },
        });
      }}
    />
  );
}
