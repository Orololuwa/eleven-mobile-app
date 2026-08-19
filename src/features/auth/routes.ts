import { selectHasCompletedOnboarding, useAppStore } from '@/stores/app-store';

export const routeAfterAuth = () =>
  selectHasCompletedOnboarding(useAppStore.getState()) ? '/(app)/(tabs)' : '/(auth)/profile-setup';
