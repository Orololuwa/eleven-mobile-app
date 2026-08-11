import { create } from 'zustand';
import type { ProfileData } from '@/screens/profile/profile-setup-screen';

type AppStore = {
  user: ProfileData | null;
  sessionCount: number;
  setUser: (user: ProfileData | null) => void;
  completeOnboarding: (user: ProfileData) => void;
  incrementSessionCount: () => void;
};

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  sessionCount: 0,
  setUser: (user) => set({ user }),
  completeOnboarding: (user) => set({ user }),
  incrementSessionCount: () => set((state) => ({ sessionCount: state.sessionCount + 1 })),
}));

export const selectIsAuthenticated = (state: AppStore) => state.user !== null;
