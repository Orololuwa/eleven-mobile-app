import React from 'react';
import { router } from 'expo-router';
import { FindWallScreen } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function FindWallRoute() {
  const setShowEmptyWallBanner = useAppStore((state) => state.setShowEmptyWallBanner);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const setUser = useAppStore((state) => state.setUser);

  const dismissBanner = () => setShowEmptyWallBanner(false);

  return (
    <FindWallScreen
      onClose={() => {
        dismissBanner();
        router.back();
      }}
      onContinueGoogle={() => {
        dismissBanner();
        completeOnboarding({
          firstName: 'Emmanuel',
          fullName: 'Emmanuel Awolusi',
          position: 'MID',
          preferredFoot: 'LEFT',
          heightCm: 178,
        });
        router.replace('/(app)/(tabs)');
      }}
      onUseEmail={() => {
        dismissBanner();
        setUser(null);
        router.replace('/(auth)/email-sign-in');
      }}
      onStayNew={() => {
        dismissBanner();
        router.back();
      }}
    />
  );
}
