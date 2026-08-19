import React from 'react';
import { router } from 'expo-router';
import { FindWallScreen } from '@/screens';
import { errorMessage, isUserCancelled } from '@/features/auth/errors';
import { routeAfterAuth } from '@/features/auth/routes';
import { signInWithGoogle, signOut } from '@/features/auth/use-auth-actions';
import { useAppStore } from '@/stores/app-store';

export default function FindWallRoute() {
  const setShowEmptyWallBanner = useAppStore((state) => state.setShowEmptyWallBanner);
  const dismissBanner = () => setShowEmptyWallBanner(false);

  return (
    <FindWallScreen
      onClose={() => {
        dismissBanner();
        router.back();
      }}
      onContinueGoogle={() => {
        void (async () => {
          try {
            dismissBanner();
            await signOut();
            await signInWithGoogle();
            router.replace(routeAfterAuth());
          } catch (caught) {
            if (!isUserCancelled(caught)) console.warn(errorMessage(caught));
            router.replace('/(auth)/sign-in');
          }
        })();
      }}
      onUseEmail={() => {
        void (async () => {
          dismissBanner();
          await signOut();
          router.replace('/(auth)/email-sign-in');
        })();
      }}
      onStayNew={() => {
        dismissBanner();
        router.back();
      }}
    />
  );
}
