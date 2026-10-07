import React, { useState } from 'react';
import { router } from 'expo-router';
import { HomeScreen, SessionTypeSheet } from '@/screens';
import { avatarUrlWithCacheBust, displayName } from '@/features/profile/display';
import { useMyProfileQuery } from '@/features/profile/use-profile-query';
import { beginSessionSetup } from '@/features/sessions/begin-session-setup';
import { useWeeklyStatsQuery } from '@/features/sessions/history/use-weekly-stats-query';
import { presentWeeklySection } from '@/features/sessions/history/weekly-tiles';
import { useAppStore } from '@/stores/app-store';

export default function HomeRoute() {
  const { data: profile } = useMyProfileQuery();
  const sessionCount = useAppStore((state) => state.sessionCount);
  const showEmptyWallBanner = useAppStore((state) => state.showEmptyWallBanner);
  const distanceUnit = useAppStore((state) => state.units.distance);
  const weeklyState = useWeeklyStatsQuery();
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

  return (
    <>
      <HomeScreen
        userName={displayName(profile)}
        avatarUrl={avatarUrlWithCacheBust({
          avatar_url: profile?.avatar_url,
          avatar_updated_at: profile?.avatar_updated_at,
        })}
        sessionCount={sessionCount}
        onStartSession={() => setShowSessionSheet(true)}
        onNavigateToHistory={() => router.push('/(app)/(tabs)/history')}
        onNavigateToProfile={() => router.push('/(app)/(tabs)/profile')}
        onNavigateToPlayerDetails={() => router.push('/(app)/player-details')}
        showEmptyWallBanner={showEmptyWallBanner && sessionCount === 0}
        onFindWall={() => router.push('/(app)/find-wall')}
        weekly={presentWeeklySection({ state: weeklyState, distanceUnit })}
        lastSession={lastSession}
      />
      <SessionTypeSheet
        visible={showSessionSheet}
        onClose={() => setShowSessionSheet(false)}
        onSelectType={(type) => {
          setShowSessionSheet(false);
          beginSessionSetup(type);
        }}
      />
    </>
  );
}
