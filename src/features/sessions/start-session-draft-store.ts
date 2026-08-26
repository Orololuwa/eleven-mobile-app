import { create } from 'zustand';
import type { LocationIn } from '@/features/pitches/types';
import type { AttackDirection, PlayStructure, SessionType } from './types';

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
  attackDirection: AttackDirection;
  setSessionType: (sessionType: SessionType) => void;
  setPlayStructure: (playStructure: PlayStructure) => void;
  setPlannedSegmentLengthMinutes: (minutes: number | null) => void;
  setPitch: ({ pitchId, pitchName }: { pitchId: string; pitchName: string }) => void;
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
    }),
  setSkipHeatmap: () =>
    set({
      pitchId: null,
      pitchName: null,
      skipHeatmap: true,
      corners: emptyCorners,
    }),
  clearPitchSelection: () =>
    set({
      pitchId: null,
      pitchName: null,
      skipHeatmap: false,
      corners: emptyCorners,
    }),
  setCorners: (corners) =>
    set((state) => ({
      corners: { ...state.corners, ...corners },
    })),
  setAttackDirection: (attackDirection) => set({ attackDirection }),
  reset: () => set({ ...emptyDraft, corners: emptyCorners }),
}));
