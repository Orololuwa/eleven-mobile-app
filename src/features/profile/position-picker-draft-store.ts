import { create } from 'zustand';
import type { PositionIn } from './types';

type PositionPickerDraftStore = {
  positions: PositionIn[];
  displayName: string;
  preferredFootIndex: number;
  setPositions: (positions: PositionIn[]) => void;
  setDisplayName: (displayName: string) => void;
  setPreferredFootIndex: (preferredFootIndex: number) => void;
  reset: () => void;
};

const emptyDraft = {
  positions: [] as PositionIn[],
  displayName: '',
  preferredFootIndex: 0,
};

export const usePositionPickerDraftStore = create<PositionPickerDraftStore>((set) => ({
  ...emptyDraft,
  setPositions: (positions) => set({ positions }),
  setDisplayName: (displayName) => set({ displayName }),
  setPreferredFootIndex: (preferredFootIndex) => set({ preferredFootIndex }),
  reset: () => set(emptyDraft),
}));
