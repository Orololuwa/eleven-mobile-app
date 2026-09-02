import { create } from 'zustand';
import type { LocationIn, PitchRead } from '@/features/pitches/types';
import type { AttackDirection, PlayStructure, SessionType } from './types';
import { pitchCornersFromRead } from './tracking/db';
import type { StoredPitchCorners } from './tracking/types';

export type PitchCornersDraft = {
  end_a_corner_1: LocationIn | null;
  end_a_corner_2: LocationIn | null;
  end_b_corner_1: LocationIn | null;
  end_b_corner_2: LocationIn | null;
};

type StartSessionDraftStore = {
  sessionType: SessionType;
  playStructure: PlayStructure | null;
  plannedSegmentLengthMinutes: number | null;
  pitchId: string | null;
  pitchName: string | null;
  skipHeatmap: boolean;
  corners: PitchCornersDraft;
  pitchCorners: StoredPitchCorners | null;
  attackDirection: AttackDirection;
  setSessionType: (sessionType: SessionType) => void;
  setPlayStructure: (playStructure: PlayStructure) => void;
  setPlannedSegmentLengthMinutes: (minutes: number | null) => void;
  setPitch: ({ pitchId, pitchName }: { pitchId: string; pitchName: string }) => void;
  setPitchFromRead: (pitch: PitchRead) => void;
  setSkipHeatmap: () => void;
  clearPitchSelection: () => void;
  setCorners: (corners: Partial<PitchCornersDraft>) => void;
  setAttackDirection: (attackDirection: AttackDirection) => void;
  reset: () => void;
};

const emptyCorners: PitchCornersDraft = {
  end_a_corner_1: null,
  end_a_corner_2: null,
  end_b_corner_1: null,
  end_b_corner_2: null,
};

const emptyDraft = {
  sessionType: 'match' as SessionType,
  playStructure: null as PlayStructure | null,
  plannedSegmentLengthMinutes: null as number | null,
  pitchId: null as string | null,
  pitchName: null as string | null,
  skipHeatmap: false,
  corners: emptyCorners,
  pitchCorners: null as StoredPitchCorners | null,
  attackDirection: 'end_a' as AttackDirection,
};

export const useStartSessionDraftStore = create<StartSessionDraftStore>((set) => ({
  ...emptyDraft,
  setSessionType: (sessionType) => set({ sessionType }),
  setPlayStructure: (playStructure) =>
    set((state) => ({
      playStructure,
      ...(playStructure === 'open'
        ? { plannedSegmentLengthMinutes: null }
        : { plannedSegmentLengthMinutes: state.plannedSegmentLengthMinutes }),
    })),
  setPlannedSegmentLengthMinutes: (plannedSegmentLengthMinutes) =>
    set({ plannedSegmentLengthMinutes }),
  setPitch: ({ pitchId, pitchName }) =>
    set({
      pitchId,
      pitchName,
      skipHeatmap: false,
      corners: emptyCorners,
      pitchCorners: null,
    }),
  setPitchFromRead: (pitch) =>
    set({
      pitchId: pitch.id,
      pitchName: pitch.name,
      skipHeatmap: false,
      corners: emptyCorners,
      pitchCorners: pitchCornersFromRead(pitch),
    }),
  setSkipHeatmap: () =>
    set({
      pitchId: null,
      pitchName: null,
      skipHeatmap: true,
      corners: emptyCorners,
      pitchCorners: null,
    }),
  clearPitchSelection: () =>
    set({
      pitchId: null,
      pitchName: null,
      skipHeatmap: false,
      corners: emptyCorners,
      pitchCorners: null,
    }),
  setCorners: (corners) =>
    set((state) => ({
      corners: { ...state.corners, ...corners },
    })),
  setAttackDirection: (attackDirection) => set({ attackDirection }),
  reset: () => set({ ...emptyDraft, corners: emptyCorners }),
}));
