import React, { useState } from 'react';
import { router } from 'expo-router';
import { SavedPitchesScreen } from '@/screens';
import { ApiError } from '@/lib/api-client';
import { useSavedPitchesQuery } from '@/features/pitches/use-saved-pitches-query';
import { useUnsavePitchMutation } from '@/features/pitches/use-unsave-pitch-mutation';

export default function SavedPitchesRoute() {
  const { data: pitches = [], isLoading, error: loadError } = useSavedPitchesQuery();
  const unsavePitch = useUnsavePitchMutation();
  const [error, setError] = useState<string | null>(null);

  return (
    <SavedPitchesScreen
      pitches={pitches}
      loading={isLoading}
      busyId={unsavePitch.isPending ? (unsavePitch.variables ?? null) : null}
      error={error ?? (loadError ? 'Could not load saved pitches' : null)}
      onBack={() => router.back()}
      onRemove={(id) => {
        setError(null);
        unsavePitch.mutate(id, {
          onError: (err) => {
            setError(err instanceof ApiError ? err.detail : 'Could not remove pitch');
          },
        });
      }}
    />
  );
}
