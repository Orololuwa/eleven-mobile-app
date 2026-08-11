import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { BackupMethodSheet, HomeScreen, SessionTypeSheet } from '@/screens';
import { useAppStore } from '@/stores/app-store';

export default function HomeRoute() {
  const user = useAppStore((state) => state.user);
  const sessionCount = useAppStore((state) => state.sessionCount);
  const backupNudgeDismissed = useAppStore((state) => state.backupNudgeDismissed);
  const showEmptyWallBanner = useAppStore((state) => state.showEmptyWallBanner);
  const dismissBackupNudge = useAppStore((state) => state.dismissBackupNudge);
  const updateSignInMethod = useAppStore((state) => state.updateSignInMethod);
  const signInMethods = useAppStore((state) => state.signInMethods);

  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [showBackupNudge, setShowBackupNudge] = useState(false);

  useEffect(() => {
    if (sessionCount === 1 && !backupNudgeDismissed) {
      setShowBackupNudge(true);
    }
  }, [sessionCount, backupNudgeDismissed]);

  const lastSession =
    sessionCount > 0
      ? {
          title: 'Sunday Match',
          date: '03 AUG',
          location: 'Lekki',
          type: '7-A-SIDE',
          distance: 8.4,
          topSpeed: 31,
        }
      : undefined;

  const weeklyStats = {
    sessions: sessionCount > 0 ? 4 : 0,
    distance: sessionCount > 0 ? 27.1 : 0,
    minutes: sessionCount > 0 ? 312 : 0,
  };

  const connectedProvider = signInMethods.find((method) => method.connected)?.label || 'Google';

  return (
    <>
      <HomeScreen
        userName={user?.firstName || 'Player'}
        sessionCount={sessionCount}
        onStartSession={() => setShowSessionSheet(true)}
        onNavigateToHistory={() => router.push('/(app)/(tabs)/history')}
        onNavigateToProfile={() => router.push('/(app)/(tabs)/profile')}
        showEmptyWallBanner={showEmptyWallBanner && sessionCount === 0}
        onFindWall={() => router.push('/(app)/find-wall')}
        weeklyStats={weeklyStats}
        lastSession={lastSession}
        streak={sessionCount > 0 ? 18 : undefined}
      />
      <SessionTypeSheet
        visible={showSessionSheet}
        onClose={() => setShowSessionSheet(false)}
        onSelectType={(type) => {
          setShowSessionSheet(false);
          router.push({
            pathname: '/(app)/pitch-setup',
            params: { sessionType: type },
          });
        }}
      />
      <BackupMethodSheet
        visible={showBackupNudge}
        providerLabel={connectedProvider}
        onAddApple={() => {
          setShowBackupNudge(false);
          dismissBackupNudge();
          router.push('/(app)/link-conflict');
        }}
        onAddEmail={() => {
          setShowBackupNudge(false);
          dismissBackupNudge();
          updateSignInMethod('email', {
            connected: true,
            email: 'emmanuel.a@gmail.com',
            since: 'TODAY',
          });
          router.push('/(app)/sign-in-methods');
        }}
        onDismiss={() => {
          setShowBackupNudge(false);
          dismissBackupNudge();
        }}
      />
    </>
  );
}
