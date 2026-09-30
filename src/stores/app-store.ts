import { create } from 'zustand';
import { emptySignInMethods, methodsFromUser } from '@/features/auth/map-identities';
import type { AuthStatus, AuthUser } from '@/features/auth/types';
import type { SignInMethod, UnitsPreference } from '@/types/profile';

type AppStore = {
  authStatus: AuthStatus;
  authUser: AuthUser | null;
  onboardingCompleted: boolean;
  sessionCount: number;
  units: UnitsPreference;
  signInMethods: SignInMethod[];
  showEmptyWallBanner: boolean;
  setAuthStatus: (status: AuthStatus) => void;
  applyAuthUser: (authUser: AuthUser) => void;
  applySession: ({
    authUser,
    onboardingCompleted,
  }: {
    authUser: AuthUser;
    onboardingCompleted: boolean;
  }) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  incrementSessionCount: () => void;
  setUnits: (units: UnitsPreference) => void;
  setShowEmptyWallBanner: (show: boolean) => void;
  resetAuth: () => void;
};

const defaultUnits: UnitsPreference = { distance: 'km', mass: 'kg' };

export const useAppStore = create<AppStore>((set) => ({
  authStatus: 'loading',
  authUser: null,
  onboardingCompleted: false,
  sessionCount: 0,
  units: defaultUnits,
  signInMethods: emptySignInMethods(),
  showEmptyWallBanner: false,
  setAuthStatus: (authStatus) => set({ authStatus }),
  applyAuthUser: (authUser) =>
    set({
      authUser,
      signInMethods: methodsFromUser(authUser),
    }),
  applySession: ({ authUser, onboardingCompleted }) =>
    set({
      authStatus: 'authenticated',
      authUser,
      onboardingCompleted,
      signInMethods: methodsFromUser(authUser),
    }),
  setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
  incrementSessionCount: () => set((state) => ({ sessionCount: state.sessionCount + 1 })),
  setUnits: (units) => set({ units }),
  setShowEmptyWallBanner: (show) => set({ showEmptyWallBanner: show }),
  resetAuth: () =>
    set({
      authStatus: 'unauthenticated',
      authUser: null,
      onboardingCompleted: false,
      sessionCount: 0,
      showEmptyWallBanner: false,
      signInMethods: emptySignInMethods(),
      units: defaultUnits,
    }),
}));

export const selectIsAuthenticated = (state: AppStore) => state.authStatus === 'authenticated';

export const selectHasCompletedOnboarding = (state: AppStore) => state.onboardingCompleted;
