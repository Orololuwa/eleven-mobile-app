import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { fetchWeeklySessions } from '../session-api';
import { historyQueryKey } from '../query-keys';
import { getLocalSessionsInRange, getPendingDeletions } from '../tracking/db';
import { buildWeeklyStats, weekBounds, weekStartKey, type WeeklyStats } from './weekly-stats';

export type WeeklyStatsState =
  { status: 'loading' } | { status: 'offline' } | { status: 'ready'; stats: WeeklyStats };

const loadLocalWeek = async ({
  userId,
  start,
  end,
}: {
  userId: string;
  start: Date;
  end: Date;
}) => {
  const rows = await getLocalSessionsInRange({ userId, start, end });
  const deletions = await getPendingDeletions(userId);
  return { rows, deletions };
};

/**
 * THIS WEEK on Home: server sessions for the last two weeks merged with every local session in
 * that range. Recomputed when Home gains focus and when the app returns to the foreground.
 */
export const useWeeklyStatsQuery = () => {
  const userId = useAppStore((state) => state.authUser?.id ?? '');
  const distanceUnit = useAppStore((state) => state.units.distance);
  const enabled = userId !== '';
  const [now, setNow] = useState(() => new Date());
  const { baselineStart, weekStart, nextWeekStart } = weekBounds({ now });
  const scope = { userId, weekStartKey: weekStartKey(weekStart) };

  const server = useQuery({
    queryKey: historyQueryKey.weekly(scope),
    queryFn: () => fetchWeeklySessions({ start: baselineStart, end: nextWeekStart }),
    enabled,
    staleTime: 0,
    retry: 1,
  });

  const local = useQuery({
    queryKey: historyQueryKey.weeklyLocal(scope),
    queryFn: () => loadLocalWeek({ userId, start: baselineStart, end: nextWeekStart }),
    enabled,
    staleTime: 0,
    retry: false,
  });

  const { refetch: refetchServer } = server;
  const { refetch: refetchLocal } = local;
  const refresh = useCallback(() => {
    setNow(new Date());
    void refetchServer();
    void refetchLocal();
  }, [refetchServer, refetchLocal]);

  // The queries already fetch on mount; later focuses re-read.
  const hasFocused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (hasFocused.current) refresh();
      hasFocused.current = true;
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const isOffline = server.data == null && server.isError;
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        if (state.isConnected && isOffline) void refetchServer();
      }),
    [isOffline, refetchServer],
  );

  return useMemo<WeeklyStatsState>(() => {
    if (server.data == null) return { status: isOffline ? 'offline' : 'loading' };
    if (local.data == null && !local.isError) return { status: 'loading' };
    return {
      status: 'ready',
      stats: buildWeeklyStats({
        serverItems: server.data.items,
        localRows: local.data?.rows ?? [],
        deletions: local.data?.deletions ?? [],
        now,
        distanceUnit,
      }),
    };
  }, [server.data, isOffline, local.data, local.isError, now, distanceUnit]);
};
