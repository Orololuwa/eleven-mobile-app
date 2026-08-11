import { create } from 'zustand';
import type { ProfileData, SavedPitch, SignInMethod, UnitsPreference } from '@/types/profile';

type AppStore = {
  user: ProfileData | null;
  sessionCount: number;
  units: UnitsPreference;
  signInMethods: SignInMethod[];
  savedPitches: SavedPitch[];
  backupNudgeDismissed: boolean;
  showEmptyWallBanner: boolean;
  setUser: (user: ProfileData | null) => void;
  updateUser: (patch: Partial<ProfileData>) => void;
  completeOnboarding: (user: ProfileData) => void;
  incrementSessionCount: () => void;
  setUnits: (units: UnitsPreference) => void;
  setSignInMethods: (methods: SignInMethod[]) => void;
  updateSignInMethod: (id: SignInMethod['id'], patch: Partial<SignInMethod>) => void;
  dismissBackupNudge: () => void;
  setShowEmptyWallBanner: (show: boolean) => void;
  removeSavedPitch: (id: string) => void;
  signOut: () => void;
};

const defaultSignInMethods: SignInMethod[] = [
  {
    id: 'google',
    label: 'Google',
    connected: true,
    email: 'emmanuel.a@gmail.com',
    since: '12 MAR',
  },
  {
    id: 'email',
    label: 'Email Code',
    connected: true,
    email: 'emmanuel.a@gmail.com',
    since: '04 JUN',
  },
  {
    id: 'apple',
    label: 'Apple',
    connected: false,
  },
];

const defaultSavedPitches: SavedPitch[] = [
  { id: '1', name: 'Lekki Astro', size: '64 × 42 M', sessions: 12 },
  { id: '2', name: 'Surulere Pitch', size: '90 × 55 M', sessions: 8 },
  { id: '3', name: 'Ikoyi Futsal', size: '40 × 20 M', sessions: 5 },
];

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  sessionCount: 0,
  units: { distance: 'km', mass: 'kg' },
  signInMethods: defaultSignInMethods,
  savedPitches: defaultSavedPitches,
  backupNudgeDismissed: false,
  showEmptyWallBanner: false,
  setUser: (user) => set({ user }),
  updateUser: (patch) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...patch } : null,
    })),
  completeOnboarding: (user) =>
    set({
      user: {
        ...user,
        fullName: user.fullName || user.firstName,
      },
    }),
  incrementSessionCount: () => set((state) => ({ sessionCount: state.sessionCount + 1 })),
  setUnits: (units) => set({ units }),
  setSignInMethods: (methods) => set({ signInMethods: methods }),
  updateSignInMethod: (id, patch) =>
    set((state) => ({
      signInMethods: state.signInMethods.map((method) =>
        method.id === id ? { ...method, ...patch } : method,
      ),
    })),
  dismissBackupNudge: () => set({ backupNudgeDismissed: true }),
  setShowEmptyWallBanner: (show) => set({ showEmptyWallBanner: show }),
  removeSavedPitch: (id) =>
    set((state) => ({
      savedPitches: state.savedPitches.filter((pitch) => pitch.id !== id),
    })),
  signOut: () =>
    set({
      user: null,
      sessionCount: 0,
      backupNudgeDismissed: false,
      showEmptyWallBanner: false,
      signInMethods: defaultSignInMethods,
      savedPitches: defaultSavedPitches,
      units: { distance: 'km', mass: 'kg' },
    }),
}));

export const selectIsAuthenticated = (state: AppStore) => state.user !== null;
