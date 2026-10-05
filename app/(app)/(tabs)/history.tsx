import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { HistoryScreen, SessionTypeSheet } from '@/screens';
import type { HistoryFilter, HistoryMonthView } from '@/screens/history/session-history';
import { beginSessionSetup } from '@/features/sessions/begin-session-setup';
import { invalidateHistory } from '@/features/sessions/history/history-cache';
import {
  formatSessionCount,
  isSameLocalDay,
  type HistoryEntry,
} from '@/features/sessions/history/merge-history';
import { useSessionHistoryQuery } from '@/features/sessions/history/use-session-history-query';
import { useAppStore } from '@/stores/app-store';

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

const HIGHLIGHT_MS = 1600;

const currentMonthShape = (now: Date) => {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  return {
    year,
    monthIndex,
    label: `${MONTH_NAMES[monthIndex]} ${year}`,
    daysInMonth: new Date(year, monthIndex + 1, 0).getDate(),
    leadingBlanks: (new Date(year, monthIndex, 1).getDay() + 6) % 7,
    today: now.getDate(),
  };
};

export default function HistoryRoute() {
  const units = useAppStore((state) => state.units);
  const distanceUnit = units.distance === 'mi' ? 'mi' : 'km';
  const [filter, setFilter] = useState<HistoryFilter>(null);
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [pendingDay, setPendingDay] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<FlatList<HistoryEntry>>(null);
  const hasFocusedOnce = useRef(false);

  const history = useSessionHistoryQuery({ sessionType: filter });
  const { entries, hasNextPage, isFetchingNextPage, fetchNextPage, month } = history;
  const shape = currentMonthShape(new Date());

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) invalidateHistory();
      hasFocusedOnce.current = true;
    }, []),
  );

  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  // Grid tap: load pages until the tapped day is reached, then scroll to its newest session.
  useEffect(() => {
    if (pendingDay == null) return;
    const index = entries.findIndex((entry) =>
      isSameLocalDay({ iso: entry.startedAt, day: pendingDay, month }),
    );
    const target = entries[index];
    if (target) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
      setHighlightedId(target.id);
      setPendingDay(null);
      return;
    }
    const dayStart = new Date(shape.year, shape.monthIndex, pendingDay).getTime();
    const oldest = entries.at(-1);
    const reachedDay = oldest != null && Date.parse(oldest.startedAt) < dayStart;
    if (reachedDay || !hasNextPage || history.serverUnavailable) {
      setPendingDay(null);
      return;
    }
    if (!isFetchingNextPage) void fetchNextPage();
  }, [
    pendingDay,
    entries,
    month,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    history.serverUnavailable,
    shape.year,
    shape.monthIndex,
  ]);

  const monthView: HistoryMonthView = useMemo(
    () => ({
      label: shape.label,
      daysInMonth: shape.daysInMonth,
      leadingBlanks: shape.leadingBlanks,
      today: shape.today,
      filledDays: new Set(history.calendarDays.keys()),
      isReady: history.isCalendarReady,
    }),
    [
      shape.label,
      shape.daysInMonth,
      shape.leadingBlanks,
      shape.today,
      history.calendarDays,
      history.isCalendarReady,
    ],
  );

  const changeFilter = (next: HistoryFilter) => {
    setPendingDay(null);
    setFilter(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const leaveHistory = (pathname: '/(app)/(tabs)' | '/(app)/(tabs)/profile') => {
    setFilter(null);
    setPendingDay(null);
    router.push(pathname);
  };

  return (
    <>
      <HistoryScreen
        entries={entries}
        countLabel={history.isCountReady ? formatSessionCount(history.count) : null}
        filter={filter}
        month={monthView}
        pressedDay={pendingDay}
        highlightedId={highlightedId}
        distanceUnit={distanceUnit}
        isInitialLoading={history.isInitialLoading}
        isFetchingNextPage={isFetchingNextPage}
        serverUnavailable={history.serverUnavailable}
        listRef={listRef}
        onChangeFilter={changeFilter}
        onPressDay={setPendingDay}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onRetry={history.retryServer}
        onSelectSession={(entry) =>
          router.push({
            pathname: '/(app)/session-summary',
            params: { sessionId: entry.id, from: 'history' },
          })
        }
        onStartSession={() => setShowSessionSheet(true)}
        onNavigateToHome={() => leaveHistory('/(app)/(tabs)')}
        onNavigateToProfile={() => leaveHistory('/(app)/(tabs)/profile')}
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
