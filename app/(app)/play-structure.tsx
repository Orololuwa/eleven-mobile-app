import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { PlayStructureScreen } from '@/screens';
import { useStartSessionDraftStore } from '@/features/sessions/start-session-draft-store';
import type { PlayStructure, SessionType } from '@/features/sessions/types';
import { validatePlannedSegmentLength } from '@/features/sessions/validation';

const isSessionType = (value: string): value is SessionType =>
  value === 'match' || value === 'training' || value === 'futsal';

export default function PlayStructureRoute() {
  const { sessionType: sessionTypeParam = 'match' } = useLocalSearchParams<{
    sessionType?: string;
  }>();
  const sessionType = isSessionType(sessionTypeParam) ? sessionTypeParam : 'match';

  const draftPlayStructure = useStartSessionDraftStore((s) => s.playStructure);
  const plannedSegmentLengthMinutes = useStartSessionDraftStore(
    (s) => s.plannedSegmentLengthMinutes,
  );
  const setSessionType = useStartSessionDraftStore((s) => s.setSessionType);
  const setPlayStructure = useStartSessionDraftStore((s) => s.setPlayStructure);
  const setPlannedSegmentLengthMinutes = useStartSessionDraftStore(
    (s) => s.setPlannedSegmentLengthMinutes,
  );
  const resetDraft = useStartSessionDraftStore((s) => s.reset);

  const [error, setError] = useState<string | null>(null);

  const playStructure: PlayStructure = draftPlayStructure ?? 'halves';

  useEffect(() => {
    setSessionType(sessionType);
    if (!draftPlayStructure) setPlayStructure('halves');
  }, [sessionType, draftPlayStructure, setSessionType, setPlayStructure]);

  const handleContinue = () => {
    setError(null);
    const lengthError = validatePlannedSegmentLength({
      playStructure,
      minutes: plannedSegmentLengthMinutes,
    });
    if (lengthError) {
      setError(lengthError);
      return;
    }

    router.push({
      pathname: '/(app)/pitch-setup',
      params: { sessionType },
    });
  };

  return (
    <PlayStructureScreen
      playStructure={playStructure}
      plannedSegmentLengthMinutes={plannedSegmentLengthMinutes}
      error={error}
      onSelectStructure={(structure) => {
        setError(null);
        setPlayStructure(structure);
        if (structure === 'open') setPlannedSegmentLengthMinutes(null);
      }}
      onChangeMinutes={(minutes) => {
        setError(null);
        setPlannedSegmentLengthMinutes(minutes);
      }}
      onContinue={handleContinue}
      onBack={() => {
        resetDraft();
        router.back();
      }}
    />
  );
}
