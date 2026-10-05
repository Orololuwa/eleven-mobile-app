import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { fetchSessionCalendar, fetchSessionHistoryPage } from '../session-api';
import { historyQueryKey } from '../query-keys';
import { getLocalHistorySessions, getPendingDeletions, getPendingRenames } from '../tracking/db';
import type { SessionType } from '../types';
import { buildCalendarDays, countHistory, mergeHistory, monthKey } from './merge-history';

const loadLocalHistory = async ({
  userId,
  sessionType,
}: {
  userId: string;
  sessionType: SessionType | null;
}) => {
  const rows = await getLocalHistorySessions({ userId, sessionType });
  const deletions = await getPendingDeletions(userId);
  const renames = await getPendingRenames(userId);
  return { rows, deletions, renames };
};

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * History list, count and current-month grid: server reads merged with this device's
 * unsynced sessions and queued deletes / renames. The three reads run in parallel.
 */
export const useSessionHistoryQuery = ({
  sessionType = null,
}: {
  sessionType?: SessionType | null;
}) => {
  const userId = useAppStore((state) => state.authUser?.id ?? '');
  const enabled = userId !== '';
  const month = monthKey(new Date());
  const scope = { userId, sessionType };

  const local = useQuery({
    queryKey: historyQueryKey.local(scope),
    queryFn: () => loadLocalHistory(scope),
    enabled,
    staleTime: 0,
    retry: false,
  });

  const list = useInfiniteQuery({
    queryKey: historyQueryKey.list(scope),
    queryFn: ({ pageParam }) => fetchSessionHistoryPage({ sessionType, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    enabled,
    staleTime: 0,
    retry: 1,
  });

  const calendar = useQuery({
    queryKey: historyQueryKey.calendar({ ...scope, month }),
    queryFn: () => fetchSessionCalendar({ month, tz: deviceTimeZone(), sessionType }),
    enabled,
    staleTime: 0,
    retry: 1,
  });

  const localRows = useMemo(() => local.data?.rows ?? [], [local.data]);
  const deletions = useMemo(() => local.data?.deletions ?? [], [local.data]);
  const renames = useMemo(() => local.data?.renames ?? [], [local.data]);
  const serverItems = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data],
  );
  const serverUnavailable = list.isError && !list.data;
  const serverExhausted = serverUnavailable || (list.data != null && !list.hasNextPage);

  const entries = useMemo(
    () => mergeHistory({ serverItems, serverExhausted, localRows, deletions, renames }),
    [serverItems, serverExhausted, localRows, deletions, renames],
  );

  const totalCount = list.data?.pages[0]?.total_count ?? null;
  const count = countHistory({ totalCount, localRows, deletions, sessionType });

  const calendarDays = useMemo(
    () => buildCalendarDays({ calendar: calendar.data, localRows, deletions, month }),
    [calendar.data, localRows, deletions, month],
  );

  return {
    entries,
    count,
    isCountReady: list.data != null || serverUnavailable,
    calendarDays,
    isCalendarReady: calendar.data != null || calendar.isError,
    month,
    isInitialLoading: list.isPending && !serverUnavailable && entries.length === 0,
    serverUnavailable,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    fetchNextPage: list.fetchNextPage,
    retryServer: () => {
      void list.refetch();
      void calendar.refetch();
    },
  };
};
