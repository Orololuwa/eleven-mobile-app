import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PitchSetupScreen, type PitchSetupStep } from '@/screens/session/pitch-setup';
import { ApiError } from '@/lib/api-client';
import { getCurrentDeviceLocation } from '@/features/pitches/location';
import { useCheckSimilarPitches } from '@/features/pitches/use-check-similar-pitches';
import { useCreatePitchMutation } from '@/features/pitches/use-create-pitch-mutation';
import { useNearbyPitchesQuery } from '@/features/pitches/use-nearby-pitches-query';
import { useSavePitchMutation } from '@/features/pitches/use-save-pitch-mutation';
import { validatePitchName } from '@/features/pitches/validation';
import type { LocationIn, PitchRead } from '@/features/pitches/types';
import { useStartSessionDraftStore } from '@/features/sessions/start-session-draft-store';
import { useCreateSessionMutation } from '@/features/sessions/use-create-session-mutation';
import { useStartSessionMutation } from '@/features/sessions/use-start-session-mutation';
import type { PlayStructure, SessionType } from '@/features/sessions/types';

type CornerKey = 'end_a_corner_1' | 'end_a_corner_2' | 'end_b_corner_1' | 'end_b_corner_2';

const CORNER_ORDER: CornerKey[] = [
  'end_a_corner_1',
  'end_a_corner_2',
  'end_b_corner_1',
  'end_b_corner_2',
];

const isSessionType = (value: string): value is SessionType =>
  value === 'match' || value === 'training' || value === 'futsal';

export default function PitchSetupRoute() {
  const { sessionType: sessionTypeParam = 'match' } = useLocalSearchParams<{
    sessionType?: string;
  }>();
  const sessionType = isSessionType(sessionTypeParam) ? sessionTypeParam : 'match';

  const playStructure = useStartSessionDraftStore((s) => s.playStructure);
  const plannedSegmentLengthMinutes = useStartSessionDraftStore(
    (s) => s.plannedSegmentLengthMinutes,
  );
  const pitchId = useStartSessionDraftStore((s) => s.pitchId);
  const pitchNameDraft = useStartSessionDraftStore((s) => s.pitchName);
  const skipHeatmap = useStartSessionDraftStore((s) => s.skipHeatmap);
  const corners = useStartSessionDraftStore((s) => s.corners);
  const attackDirection = useStartSessionDraftStore((s) => s.attackDirection);
  const setPitch = useStartSessionDraftStore((s) => s.setPitch);
  const setSkipHeatmap = useStartSessionDraftStore((s) => s.setSkipHeatmap);
  const clearPitchSelection = useStartSessionDraftStore((s) => s.clearPitchSelection);
  const setCorners = useStartSessionDraftStore((s) => s.setCorners);
  const setAttackDirection = useStartSessionDraftStore((s) => s.setAttackDirection);
  const resetDraft = useStartSessionDraftStore((s) => s.reset);

  const [step, setStep] = useState<PitchSetupStep>('source');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [dismissedNearby, setDismissedNearby] = useState(false);
  const [pitchName, setPitchName] = useState('');
  const [pitchNameError, setPitchNameError] = useState<string | undefined>();
  const [similarPitches, setSimilarPitches] = useState<PitchRead[]>([]);
  const [error, setError] = useState<string | null>(null);

  const nearbyQuery = useNearbyPitchesQuery({
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  });
  const savePitch = useSavePitchMutation();
  const createPitch = useCreatePitchMutation();
  const checkSimilar = useCheckSimilarPitches();
  const createSession = useCreateSessionMutation();
  const startSession = useStartSessionMutation();

  const markedCornerCount = CORNER_ORDER.filter((key) => corners[key] != null).length;

  const nearbyPitch = useMemo(() => {
    if (dismissedNearby || !nearbyQuery.data?.length) return null;
    return nearbyQuery.data[0] ?? null;
  }, [dismissedNearby, nearbyQuery.data]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLocationBusy(true);
      try {
        const location = await getCurrentDeviceLocation();
        if (cancelled || !location) return;
        setCoords({ lat: location.lat, lng: location.lng });
        setGpsAccuracy(location.accuracy);
      } finally {
        if (!cancelled) setLocationBusy(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (pitchId && step === 'source') {
        setStep('kickoff');
      }
    }, [pitchId, step]),
  );

  const structure: PlayStructure = playStructure ?? 'halves';

  const goKickoffWithPitch = ({ id, name }: { id: string; name: string }) => {
    setPitch({ pitchId: id, pitchName: name });
    setStep('kickoff');
  };

  const handleUseNearby = async () => {
    if (!nearbyPitch) return;
    setError(null);
    try {
      await savePitch.mutateAsync(nearbyPitch.id);
      goKickoffWithPitch({ id: nearbyPitch.id, name: nearbyPitch.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not save pitch');
    }
  };

  const handleMarkNew = async () => {
    setError(null);
    setLocationBusy(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) {
        setError('Location permission is required to mark a pitch');
        return;
      }
      setCoords({ lat: location.lat, lng: location.lng });
      setGpsAccuracy(location.accuracy);
      setStep('mark');
    } finally {
      setLocationBusy(false);
    }
  };

  const handleMarkCorner = async () => {
    setError(null);
    const nextKey = CORNER_ORDER[markedCornerCount];
    if (!nextKey) return;

    setLocationBusy(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) {
        setError('Could not read GPS. Check location permissions.');
        return;
      }
      setGpsAccuracy(location.accuracy);
      const point: LocationIn = { lat: location.lat, lng: location.lng };
      setCorners({ [nextKey]: point });

      if (markedCornerCount + 1 >= 4) {
        setStep('name');
      }
    } finally {
      setLocationBusy(false);
    }
  };

  const cornersPayload = () => {
    const { end_a_corner_1, end_a_corner_2, end_b_corner_1, end_b_corner_2 } = corners;
    if (!end_a_corner_1 || !end_a_corner_2 || !end_b_corner_1 || !end_b_corner_2) {
      return null;
    }
    return { end_a_corner_1, end_a_corner_2, end_b_corner_1, end_b_corner_2 };
  };

  const createNewPitch = async () => {
    const payload = cornersPayload();
    if (!payload) {
      setError('Mark all four corners first');
      return;
    }
    const nameError = validatePitchName(pitchName);
    if (nameError) {
      setPitchNameError(nameError);
      return;
    }
    const pitch = await createPitch.mutateAsync({
      name: pitchName.trim(),
      ...payload,
    });
    goKickoffWithPitch({ id: pitch.id, name: pitch.name });
  };

  const handleSubmitName = async () => {
    setError(null);
    setPitchNameError(undefined);
    const nameError = validatePitchName(pitchName);
    if (nameError) {
      setPitchNameError(nameError);
      return;
    }
    const payload = cornersPayload();
    if (!payload) {
      setError('Mark all four corners first');
      return;
    }

    try {
      const matches = await checkSimilar.mutateAsync(payload);
      if (matches.length > 0) {
        setSimilarPitches(matches);
        setStep('similar');
        return;
      }
      await createNewPitch();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not check similar pitches');
    }
  };

  const handleSelectSimilar = async (pitch: PitchRead) => {
    setError(null);
    try {
      await savePitch.mutateAsync(pitch.id);
      goKickoffWithPitch({ id: pitch.id, name: pitch.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not save pitch');
    }
  };

  const handleCreateAnyway = async () => {
    setError(null);
    try {
      await createNewPitch();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not create pitch');
    }
  };

  const handleKickOff = async () => {
    setError(null);
    try {
      const session = await createSession.mutateAsync({
        session_type: sessionType,
        play_structure: structure,
        planned_segment_length_minutes:
          structure === 'open' ? undefined : (plannedSegmentLengthMinutes ?? undefined),
        pitch_id: skipHeatmap ? null : pitchId,
      });

      await startSession.mutateAsync({
        sessionId: session.id,
        body: skipHeatmap || !pitchId ? {} : { attack_direction: attackDirection },
      });

      resetDraft();
      router.replace({
        pathname: '/(app)/active-session',
        params: { sessionType, sessionId: session.id },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not start session');
    }
  };

  const busy =
    savePitch.isPending ||
    createPitch.isPending ||
    checkSimilar.isPending ||
    createSession.isPending ||
    startSession.isPending;

  return (
    <PitchSetupScreen
      sessionType={sessionType}
      step={step}
      markedCornerCount={markedCornerCount}
      gpsAccuracy={gpsAccuracy}
      locationBusy={locationBusy}
      nearbyPitch={nearbyPitch}
      nearbyLoading={nearbyQuery.isFetching && !nearbyPitch}
      pitchName={pitchName}
      pitchNameError={pitchNameError}
      similarPitches={similarPitches}
      selectedPitchName={pitchNameDraft}
      skipHeatmap={skipHeatmap}
      attackDirection={attackDirection}
      busy={busy}
      error={error}
      onUseNearby={() => {
        void handleUseNearby();
      }}
      onDismissNearby={() => setDismissedNearby(true)}
      onUseSaved={() => router.push('/(app)/select-saved-pitch')}
      onMarkNew={() => {
        void handleMarkNew();
      }}
      onSkip={() => {
        setSkipHeatmap();
        setStep('kickoff');
      }}
      onMarkCorner={() => {
        void handleMarkCorner();
      }}
      onChangePitchName={(name) => {
        setPitchName(name);
        setPitchNameError(undefined);
      }}
      onSubmitName={() => {
        void handleSubmitName();
      }}
      onSelectSimilar={(pitch) => {
        void handleSelectSimilar(pitch);
      }}
      onCreateAnyway={() => {
        void handleCreateAnyway();
      }}
      onFlipAttack={() => setAttackDirection(attackDirection === 'end_a' ? 'end_b' : 'end_a')}
      onKickOff={() => {
        void handleKickOff();
      }}
      onBack={() => {
        if (step === 'kickoff') {
          clearPitchSelection();
          setStep('source');
          return;
        }
        if (step === 'similar') {
          setStep('name');
          return;
        }
        if (step === 'name') {
          setStep('mark');
          return;
        }
        if (step === 'mark') {
          clearPitchSelection();
          setStep('source');
          return;
        }
        router.back();
      }}
    />
  );
}
