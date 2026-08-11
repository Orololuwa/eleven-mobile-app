import React, { useState } from 'react';
import { router } from 'expo-router';
import { HomeScreen, SessionTypeSheet } from '@/screens';
import { useApp } from '@/providers/app-provider';

export default function HomeRoute() {
  const { user, sessionCount } = useApp();
  const [showSessionSheet, setShowSessionSheet] = useState(false);

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

  return (
    <>
      <HomeScreen
        userName={user?.firstName || 'Player'}
        sessionCount={sessionCount}
        onStartSession={() => setShowSessionSheet(true)}
        onNavigateToHistory={() => router.push('/(app)/(tabs)/history')}
        onNavigateToProfile={() => router.push('/(app)/(tabs)/profile')}
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
    </>
  );
}
