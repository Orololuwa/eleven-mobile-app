import { create } from 'zustand';
import type { PositionIn } from './types';

type PositionPickerDraftStore = {
  positions: PositionIn[];
  setPositions: (positions: PositionIn[]) => void;
  reset: () => void;
};

export const usePositionPickerDraftStore = create<PositionPickerDraftStore>((set) => ({
  positions: [],
  setPositions: (positions) => set({ positions }),
  reset: () => set({ positions: [] }),
}));
