import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { PlayStructureScreen } from '@/screens';
import { ApiError } from '@/lib/api-client';
import { useStartSessionDraftStore } from '@/features/sessions/start-session-draft-store';
import { useCreateSessionMutation } from '@/features/sessions/use-create-session-mutation';
import { useStartSessionMutation } from '@/features/sessions/use-start-session-mutation';
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
  const setSkipHeatmap = useStartSessionDraftStore((s) => s.setSkipHeatmap);
  const resetDraft = useStartSessionDraftStore((s) => s.reset);

  const createSession = useCreateSessionMutation();
  const startSession = useStartSessionMutation();

  const [step, setStep] = useState<'structure' | 'kickoff'>('structure');
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

    if (playStructure === 'open') {
      setSkipHeatmap();
      setStep('kickoff');
      return;
    }

    router.push({
      pathname: '/(app)/pitch-setup',
      params: { sessionType },
    });
  };

  const handleKickOff = async () => {
    setError(null);
    try {
      const session = await createSession.mutateAsync({
        session_type: sessionType,
        play_structure: 'open',
        pitch_id: null,
      });
      await startSession.mutateAsync({ sessionId: session.id, body: {} });
      resetDraft();
      router.replace({
        pathname: '/(app)/active-session',
        params: { sessionType, sessionId: session.id },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not start session');
    }
  };

  const busy = createSession.isPending || startSession.isPending;

  return (
    <PlayStructureScreen
      sessionType={sessionType}
      playStructure={playStructure}
      plannedSegmentLengthMinutes={plannedSegmentLengthMinutes}
      step={step}
      busy={busy}
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
      onKickOff={() => {
        void handleKickOff();
      }}
      onBack={() => {
        if (step === 'kickoff') {
          setStep('structure');
          return;
        }
        resetDraft();
        router.back();
      }}
    />
  );
}
