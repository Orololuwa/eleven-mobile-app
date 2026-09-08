import { create } from 'zustand';
import type { LocationIn, PitchRead } from '@/features/pitches/types';
import type { ActivityKind, AttackDirection, PlayStructure, SessionType } from './types';
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
  extraTimeEnabled: boolean | null;
  plannedExtraTimeSegmentLengthMinutes: number | null;
  trainingActivityOptions: ActivityKind[];
  startingActivityKind: ActivityKind | null;
  pitchId: string | null;
  pitchName: string | null;
  skipHeatmap: boolean;
  corners: PitchCornersDraft;
  pitchCorners: StoredPitchCorners | null;
  attackDirection: AttackDirection;
  setSessionType: (sessionType: SessionType) => void;
  setPlayStructure: (playStructure: PlayStructure) => void;
  setPlannedSegmentLengthMinutes: (minutes: number | null) => void;
  setExtraTimeEnabled: (enabled: boolean | null) => void;
  setPlannedExtraTimeSegmentLengthMinutes: (minutes: number | null) => void;
  setTrainingActivityOptions: (options: ActivityKind[]) => void;
  toggleTrainingActivityOption: (option: ActivityKind) => void;
  setStartingActivityKind: (kind: ActivityKind | null) => void;
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
  extraTimeEnabled: null as boolean | null,
  plannedExtraTimeSegmentLengthMinutes: null as number | null,
  trainingActivityOptions: [] as ActivityKind[],
  startingActivityKind: null as ActivityKind | null,
  pitchId: null as string | null,
  pitchName: null as string | null,
  skipHeatmap: false,
  corners: emptyCorners,
  pitchCorners: null as StoredPitchCorners | null,
  attackDirection: 'end_a' as AttackDirection,
};

const clearExtraTime = {
  extraTimeEnabled: null as boolean | null,
  plannedExtraTimeSegmentLengthMinutes: null as number | null,
};

const clearTraining = {
  trainingActivityOptions: [] as ActivityKind[],
  startingActivityKind: null as ActivityKind | null,
};

export const useStartSessionDraftStore = create<StartSessionDraftStore>((set) => ({
  ...emptyDraft,
  setSessionType: (sessionType) => set({ sessionType }),
  setPlayStructure: (playStructure) =>
    set((state) => ({
      playStructure,
      ...(playStructure === 'training_activities'
        ? { plannedSegmentLengthMinutes: null, ...clearExtraTime }
        : playStructure === 'sets'
          ? { plannedSegmentLengthMinutes: state.plannedSegmentLengthMinutes, ...clearExtraTime }
          : {
              plannedSegmentLengthMinutes: state.plannedSegmentLengthMinutes,
            }),
      ...(playStructure !== 'training_activities' ? clearTraining : {}),
    })),
  setPlannedSegmentLengthMinutes: (plannedSegmentLengthMinutes) =>
    set({ plannedSegmentLengthMinutes }),
  setExtraTimeEnabled: (extraTimeEnabled) =>
    set({
      extraTimeEnabled,
      ...(extraTimeEnabled === true ? {} : { plannedExtraTimeSegmentLengthMinutes: null }),
    }),
  setPlannedExtraTimeSegmentLengthMinutes: (plannedExtraTimeSegmentLengthMinutes) =>
    set({ plannedExtraTimeSegmentLengthMinutes }),
  setTrainingActivityOptions: (trainingActivityOptions) =>
    set((state) => ({
      trainingActivityOptions,
      startingActivityKind:
        state.startingActivityKind && trainingActivityOptions.includes(state.startingActivityKind)
          ? state.startingActivityKind
          : trainingActivityOptions.length === 1
            ? (trainingActivityOptions[0] ?? null)
            : null,
    })),
  toggleTrainingActivityOption: (option) =>
    set((state) => {
      const exists = state.trainingActivityOptions.includes(option);
      const trainingActivityOptions = exists
        ? state.trainingActivityOptions.filter((item) => item !== option)
        : [...state.trainingActivityOptions, option];
      return {
        trainingActivityOptions,
        startingActivityKind:
          state.startingActivityKind && trainingActivityOptions.includes(state.startingActivityKind)
            ? state.startingActivityKind
            : trainingActivityOptions.length === 1
              ? (trainingActivityOptions[0] ?? null)
              : null,
      };
    }),
  setStartingActivityKind: (startingActivityKind) => set({ startingActivityKind }),
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
