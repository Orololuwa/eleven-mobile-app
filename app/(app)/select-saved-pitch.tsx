import { router } from 'expo-router';
import { SelectSavedPitchScreen } from '@/screens';
import { useSavedPitchesQuery } from '@/features/pitches/use-saved-pitches-query';
import { useStartSessionDraftStore } from '@/features/sessions/start-session-draft-store';

export default function SelectSavedPitchRoute() {
  const { data: pitches = [], isLoading, error } = useSavedPitchesQuery();
  const setPitchFromRead = useStartSessionDraftStore((s) => s.setPitchFromRead);

  return (
    <SelectSavedPitchScreen
      pitches={pitches}
      loading={isLoading}
      error={error ? 'Could not load saved pitches' : null}
      onBack={() => router.back()}
      onSelect={(pitch) => {
        setPitchFromRead(pitch);
        router.back();
      }}
    />
  );
}
