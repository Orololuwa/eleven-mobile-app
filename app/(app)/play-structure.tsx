import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { PlayStructureScreen } from '@/screens';
import { useStartSessionDraftStore } from '@/features/sessions/start-session-draft-store';
import type { PlayStructure, SessionType } from '@/features/sessions/types';
import {
  forcedPlayStructure,
  validateExtraTime,
  validatePlannedSegmentLength,
  validateTrainingActivityOptions,
} from '@/features/sessions/validation';

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
  const extraTimeEnabled = useStartSessionDraftStore((s) => s.extraTimeEnabled);
  const plannedExtraTimeSegmentLengthMinutes = useStartSessionDraftStore(
    (s) => s.plannedExtraTimeSegmentLengthMinutes,
  );
  const trainingActivityOptions = useStartSessionDraftStore((s) => s.trainingActivityOptions);
  const setSessionType = useStartSessionDraftStore((s) => s.setSessionType);
  const setPlayStructure = useStartSessionDraftStore((s) => s.setPlayStructure);
  const setPlannedSegmentLengthMinutes = useStartSessionDraftStore(
    (s) => s.setPlannedSegmentLengthMinutes,
  );
  const setExtraTimeEnabled = useStartSessionDraftStore((s) => s.setExtraTimeEnabled);
  const setPlannedExtraTimeSegmentLengthMinutes = useStartSessionDraftStore(
    (s) => s.setPlannedExtraTimeSegmentLengthMinutes,
  );
  const toggleTrainingActivityOption = useStartSessionDraftStore(
    (s) => s.toggleTrainingActivityOption,
  );
  const setSkipHeatmap = useStartSessionDraftStore((s) => s.setSkipHeatmap);
  const resetDraft = useStartSessionDraftStore((s) => s.reset);

  const [error, setError] = useState<string | null>(null);

  const forced = forcedPlayStructure(sessionType);
  const playStructure: PlayStructure =
    draftPlayStructure ?? forced ?? (sessionType === 'futsal' ? 'halves' : 'halves');

  useEffect(() => {
    setSessionType(sessionType);
    if (forced) {
      if (draftPlayStructure !== forced) setPlayStructure(forced);
      return;
    }
    if (!draftPlayStructure || draftPlayStructure === 'training_activities') {
      setPlayStructure('halves');
    }
  }, [sessionType, draftPlayStructure, forced, setSessionType, setPlayStructure]);

  const handleContinue = () => {
    setError(null);

    if (sessionType === 'training') {
      const activityError = validateTrainingActivityOptions({
        sessionType,
        options: trainingActivityOptions,
      });
      if (activityError) {
        setError(activityError);
        return;
      }

      const includesSet = trainingActivityOptions.includes('set');
      if (!includesSet) {
        setSkipHeatmap();
        router.push({
          pathname: '/(app)/pitch-setup',
          params: { sessionType, skipPitch: '1' },
        });
        return;
      }

      router.push({
        pathname: '/(app)/pitch-setup',
        params: { sessionType },
      });
      return;
    }

    const lengthError = validatePlannedSegmentLength({
      playStructure,
      minutes: plannedSegmentLengthMinutes,
    });
    if (lengthError) {
      setError(lengthError);
      return;
    }

    if (playStructure === 'halves') {
      const etError = validateExtraTime({
        playStructure,
        enabled: extraTimeEnabled,
        minutes: plannedExtraTimeSegmentLengthMinutes,
      });
      if (etError) {
        setError(etError);
        return;
      }
    }

    router.push({
      pathname: '/(app)/pitch-setup',
      params: { sessionType },
    });
  };

  return (
    <PlayStructureScreen
      sessionType={sessionType}
      playStructure={playStructure}
      plannedSegmentLengthMinutes={plannedSegmentLengthMinutes}
      extraTimeEnabled={extraTimeEnabled}
      plannedExtraTimeSegmentLengthMinutes={plannedExtraTimeSegmentLengthMinutes}
      trainingActivityOptions={trainingActivityOptions}
      error={error}
      onSelectStructure={(structure) => {
        setError(null);
        setPlayStructure(structure);
        if (structure === 'training_activities' || structure === 'sets') {
          setPlannedExtraTimeSegmentLengthMinutes(null);
          setExtraTimeEnabled(null);
        }
        if (structure === 'training_activities') setPlannedSegmentLengthMinutes(null);
      }}
      onChangeMinutes={(minutes) => {
        setError(null);
        setPlannedSegmentLengthMinutes(minutes);
      }}
      onSelectExtraTimeEnabled={(enabled) => {
        setError(null);
        setExtraTimeEnabled(enabled);
      }}
      onChangeExtraTimeMinutes={(minutes) => {
        setError(null);
        setPlannedExtraTimeSegmentLengthMinutes(minutes);
      }}
      onToggleTrainingActivity={(kind) => {
        setError(null);
        toggleTrainingActivityOption(kind);
      }}
      onContinue={handleContinue}
      onBack={() => {
        resetDraft();
        router.back();
      }}
    />
  );
}
