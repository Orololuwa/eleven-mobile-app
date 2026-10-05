import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Wall } from '@/components';
import { spacing, typography, type Colors, useColors, useThemedStyles } from '@/theme';
import type { DistanceUnit } from '@/types/profile';
import type { SessionType } from '@/features/sessions/types';
import type { HistoryEntry } from '@/features/sessions/history/merge-history';
import {
  distanceUnitLabel,
  formatSummaryDistance,
  formatSummarySpeed,
} from '@/features/sessions/summary/display';
import {
  INSUFFICIENT_ROW_COPY,
  NO_STATS_COPY,
  SESSION_TYPE_LABEL,
  formatHistoryMeta,
  presentSessionMetrics,
} from '@/features/sessions/summary/session-presentation';

export type HistoryFilter = SessionType | null;

export type HistoryMonthView = {
  label: string;
  daysInMonth: number;
  /** Monday = 0. */
  leadingBlanks: number;
  today: number;
  filledDays: ReadonlySet<number>;
  isReady: boolean;
};

type HistoryScreenProps = {
  entries: HistoryEntry[];
  countLabel: string | null;
  filter: HistoryFilter;
  month: HistoryMonthView;
  pressedDay: number | null;
  highlightedId: string | null;
  distanceUnit: DistanceUnit;
  isInitialLoading: boolean;
  isFetchingNextPage: boolean;
  serverUnavailable: boolean;
  listRef: React.Ref<FlatList<HistoryEntry>>;
  onChangeFilter: (filter: HistoryFilter) => void;
  onPressDay: (day: number) => void;
  onEndReached: () => void;
  onRetry: () => void;
  onSelectSession: (entry: HistoryEntry) => void;
  onStartSession: () => void;
  onNavigateToHome: () => void;
  onNavigateToProfile: () => void;
};

const FILTERS: { label: string; value: HistoryFilter }[] = [
  { label: 'ALL', value: null },
  { label: 'MATCH', value: 'match' },
  { label: 'TRAINING', value: 'training' },
  { label: 'FUTSAL', value: 'futsal' },
];

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const SYNC_COPY: Record<NonNullable<HistoryEntry['syncStatus']>, string> = {
  pending: 'WAITING TO UPLOAD',
  failed: 'WAITING TO UPLOAD',
  syncing: '↑ UPLOADING…',
  rejected: "COULDN'T UPLOAD · SAVED ON THIS PHONE ONLY",
};

const chunk = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  entries,
  countLabel,
  filter,
  month,
  pressedDay,
  highlightedId,
  distanceUnit,
  isInitialLoading,
  isFetchingNextPage,
  serverUnavailable,
  listRef,
  onChangeFilter,
  onPressDay,
  onEndReached,
  onRetry,
  onSelectSession,
  onStartSession,
  onNavigateToHome,
  onNavigateToProfile,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const isEmpty = !isInitialLoading && entries.length === 0;

  const header = (
    <View>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>History</Text>
        {countLabel == null ? (
          <View style={styles.countSkeleton} />
        ) : (
          <Text style={[styles.sessionCount, isEmpty && styles.sessionCountMuted]}>
            {countLabel}
          </Text>
        )}
      </View>

      <View style={styles.filters}>
        {FILTERS.map(({ label, value }) => (
          <Chip
            key={label}
            label={label}
            selected={filter === value}
            onPress={() => onChangeFilter(value)}
          />
        ))}
      </View>

      <MonthGrid month={month} pressedDay={pressedDay} onPressDay={onPressDay} />
    </View>
  );

  const renderItem: ListRenderItem<HistoryEntry> = ({ item }) => (
    <HistoryRow
      entry={item}
      distanceUnit={distanceUnit}
      highlighted={item.id === highlightedId}
      onPress={() => onSelectSession(item)}
    />
  );

  const emptyState = isInitialLoading ? (
    <RowSkeletons />
  ) : filter == null ? (
    <View style={styles.emptyBody}>
      <View style={styles.emptyWall}>
        <Wall total={56} built={0} />
      </View>
      <Text style={styles.emptyTitle}>Nothing here yet —{'\n'}and that's the point.</Text>
      <Text style={styles.emptyDesc}>
        Your history starts the first time you press Start Session. Match, training or futsal — it
        all counts.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onStartSession}>
        <Text style={styles.primaryButtonText}>START YOUR FIRST</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.emptyBody}>
      <Text style={styles.emptyTitle}>
        No {SESSION_TYPE_LABEL[filter].toLowerCase()} sessions yet
      </Text>
      <Text style={styles.emptyDesc}>
        {SESSION_TYPE_LABEL[filter]} you track will show up here. Everything else you've played is
        under All.
      </Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => onChangeFilter(null)}>
        <Text style={styles.secondaryButtonText}>SHOW ALL SESSIONS</Text>
      </TouchableOpacity>
    </View>
  );

  const footer = isFetchingNextPage ? (
    <View style={styles.footer}>
      <ActivityIndicator size="small" color={colors.text.secondary} />
      <Text style={styles.footerText}>LOADING OLDER SESSIONS</Text>
    </View>
  ) : serverUnavailable && entries.length > 0 ? (
    <View style={styles.footer}>
      <Text style={styles.footerNotice}>Couldn't load older sessions</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text style={styles.footerAction}>RETRY</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={listRef}
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        ListFooterComponent={footer}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          const list = listRef && 'current' in listRef ? listRef.current : null;
          list?.scrollToOffset({ offset: index * averageItemLength, animated: false });
          setTimeout(() => list?.scrollToIndex({ index, animated: true, viewPosition: 0.3 }), 50);
        }}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <TabBar active="HISTORY" onHome={onNavigateToHome} onProfile={onNavigateToProfile} />
    </SafeAreaView>
  );
};

const HistoryRow: React.FC<{
  entry: HistoryEntry;
  distanceUnit: DistanceUnit;
  highlighted: boolean;
  onPress: () => void;
}> = ({ entry, distanceUnit, highlighted, onPress }) => {
  const styles = useThemedStyles(createStyles);
  const presentation = presentSessionMetrics(entry.metrics);
  const meta = formatHistoryMeta({
    startedAt: entry.startedAt,
    pitchName: entry.pitchName,
    sessionType: entry.sessionType,
  });

  return (
    <TouchableOpacity style={[styles.row, highlighted && styles.rowHighlighted]} onPress={onPress}>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {entry.title}
      </Text>
      <View style={styles.rowMetaLine}>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
        {presentation.kind === 'metrics' ? (
          <View style={styles.rowNumbers}>
            <View style={styles.rowNumber}>
              <Text style={styles.rowNumberLabel}>{distanceUnitLabel(distanceUnit)}</Text>
              <Text style={styles.rowNumberValue}>
                {presentation.distance.kind === 'value' ? (
                  <>
                    {presentation.distance.estimated ? <Text style={styles.approx}>≈</Text> : null}
                    {formatSummaryDistance({
                      metres: presentation.distance.value,
                      unit: distanceUnit,
                    })}
                  </>
                ) : (
                  '—'
                )}
              </Text>
            </View>
            <View style={styles.rowNumber}>
              <Text style={styles.rowNumberLabel}>TOP</Text>
              {presentation.topSpeed.kind === 'value' ? (
                <Text style={[styles.rowNumberValue, styles.rowNumberAccent]}>
                  {presentation.topSpeed.estimated ? '≈' : ''}
                  {formatSummarySpeed({ kmh: presentation.topSpeed.value, unit: distanceUnit })}
                </Text>
              ) : (
                <Text style={[styles.rowNumberValue, styles.rowNumberNone]}>—</Text>
              )}
            </View>
          </View>
        ) : null}
      </View>
      {presentation.kind === 'insufficient' ? (
        <Text style={[styles.rowNote, styles.rowNoteWarn]}>{INSUFFICIENT_ROW_COPY}</Text>
      ) : null}
      {presentation.kind === 'no_metrics' ? (
        <Text style={styles.rowNote}>{NO_STATS_COPY}</Text>
      ) : null}
      {entry.syncStatus ? (
        <Text style={[styles.rowSync, entry.syncStatus === 'rejected' && styles.rowSyncDanger]}>
          {SYNC_COPY[entry.syncStatus]}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const MonthGrid: React.FC<{
  month: HistoryMonthView;
  pressedDay: number | null;
  onPressDay: (day: number) => void;
}> = ({ month, pressedDay, onPressDay }) => {
  const styles = useThemedStyles(createStyles);
  const cells = [
    ...Array.from({ length: month.leadingBlanks }, () => null),
    ...Array.from({ length: month.daysInMonth }, (_, i) => i + 1),
  ];
  const weeks = chunk(cells, 7).map((week) => [
    ...week,
    ...Array.from({ length: 7 - week.length }, () => null),
  ]);

  return (
    <View style={styles.monthSection}>
      <Text style={styles.monthLabel}>{month.label}</Text>
      <View style={styles.weekRow}>
        {WEEKDAY_LETTERS.map((letter, i) => (
          <Text key={`${letter}-${i}`} style={styles.weekday}>
            {letter}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.weekRow}>
          {week.map((day, d) => {
            if (day == null) return <View key={`blank-${w}-${d}`} style={styles.dayBlank} />;
            const isFuture = day > month.today;
            const isFilled = month.isReady && month.filledDays.has(day);
            return (
              <TouchableOpacity
                key={day}
                disabled={!isFilled}
                onPress={() => onPressDay(day)}
                style={[
                  styles.dayCell,
                  isFuture && styles.dayFuture,
                  isFilled && styles.dayFilled,
                  day === month.today && styles.dayToday,
                  pressedDay === day && styles.dayPressed,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isFuture && styles.dayTextFuture,
                    isFilled && styles.dayTextFilled,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const RowSkeletons: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  return (
    <View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.row}>
          <View style={[styles.skeletonBar, styles.skeletonTitle]} />
          <View style={[styles.skeletonBar, styles.skeletonMeta]} />
        </View>
      ))}
    </View>
  );
};

const TabBar: React.FC<{
  active: string;
  onHome: () => void;
  onProfile: () => void;
}> = ({ active, onHome, onProfile }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity style={styles.tab} onPress={onHome}>
        <Text style={active === 'HOME' ? styles.tabTextActive : styles.tabText}>HOME</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tab}>
        <Text style={active === 'HISTORY' ? styles.tabTextActive : styles.tabText}>HISTORY</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tab} onPress={onProfile}>
        <Text style={active === 'PROFILE' ? styles.tabTextActive : styles.tabText}>PROFILE</Text>
      </TouchableOpacity>
    </View>
  );
};

const mono = typography.fontFamily.mono;

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    list: {
      flex: 1,
    },
    listHeader: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[4],
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    screenTitle: {
      fontFamily: typography.fontFamily.primary,
      fontSize: 28,
      fontWeight: typography.fontWeight.black,
      letterSpacing: -0.03 * 28,
      color: colors.text.primary,
    },
    sessionCount: {
      fontFamily: mono,
      fontSize: 11,
      letterSpacing: 0.14 * 11,
      color: colors.brand.ink,
      paddingBottom: 4,
    },
    sessionCountMuted: {
      color: colors.text.secondary,
    },
    countSkeleton: {
      width: 84,
      height: 10,
      marginBottom: 6,
      backgroundColor: colors.cell,
    },
    filters: {
      flexDirection: 'row',
      paddingHorizontal: spacing[6],
      paddingBottom: 18,
      gap: 8,
    },
    monthSection: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[5],
      gap: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.subtle,
    },
    monthLabel: {
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: 0.16 * 10,
      color: colors.text.secondary,
      marginBottom: 6,
    },
    weekRow: {
      flexDirection: 'row',
      gap: 4,
    },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontFamily: mono,
      fontSize: 9,
      letterSpacing: 0.1 * 9,
      color: colors.text.tertiary,
      marginBottom: 2,
    },
    dayBlank: {
      flex: 1,
      height: 30,
    },
    dayCell: {
      flex: 1,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cell,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    dayFuture: {
      backgroundColor: 'transparent',
      borderColor: colors.border.subtle,
    },
    dayFilled: {
      backgroundColor: colors.brand.fill,
    },
    dayToday: {
      borderColor: colors.brand.ink,
    },
    dayPressed: {
      opacity: 0.55,
    },
    dayText: {
      fontFamily: mono,
      fontSize: 10,
      color: colors.text.secondary,
    },
    dayTextFuture: {
      color: colors.text.dimmed,
    },
    dayTextFilled: {
      color: colors.text.onBrand,
      fontWeight: typography.fontWeight.semibold,
    },
    row: {
      paddingHorizontal: spacing[6],
      paddingVertical: 16,
      gap: 7,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.subtle,
    },
    rowHighlighted: {
      backgroundColor: colors.brand.tint,
    },
    rowTitle: {
      fontFamily: typography.fontFamily.primary,
      fontSize: 16,
      fontWeight: typography.fontWeight.bold,
      letterSpacing: -0.01 * 16,
      color: colors.text.primary,
    },
    rowMetaLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
    },
    rowMeta: {
      flex: 1,
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: 0.1 * 10,
      color: colors.text.secondary,
    },
    rowNumbers: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 14,
    },
    rowNumber: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
    },
    rowNumberLabel: {
      fontFamily: mono,
      fontSize: 9,
      letterSpacing: 0.14 * 9,
      color: colors.text.secondary,
    },
    rowNumberValue: {
      fontFamily: mono,
      fontSize: 17,
      letterSpacing: -0.02 * 17,
      color: colors.text.primary,
    },
    rowNumberAccent: {
      color: colors.brand.ink,
    },
    rowNumberNone: {
      color: colors.text.tertiary,
    },
    approx: {
      color: colors.text.secondary,
    },
    rowNote: {
      fontSize: 13,
      lineHeight: 13 * 1.3,
      color: colors.text.secondary,
    },
    rowNoteWarn: {
      color: colors.accent.warning,
    },
    rowSync: {
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: 0.14 * 10,
      color: colors.text.secondary,
    },
    rowSyncDanger: {
      color: colors.accent.danger,
    },
    skeletonBar: {
      backgroundColor: colors.cell,
      height: 12,
    },
    skeletonTitle: {
      width: '60%',
      height: 16,
    },
    skeletonMeta: {
      width: '40%',
      height: 10,
    },
    footer: {
      paddingHorizontal: spacing[6],
      paddingVertical: spacing[5],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    footerText: {
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: 0.16 * 10,
      color: colors.text.secondary,
    },
    footerNotice: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    footerAction: {
      fontFamily: mono,
      fontSize: 11,
      letterSpacing: 0.16 * 11,
      color: colors.brand.ink,
    },
    emptyBody: {
      paddingHorizontal: spacing[6],
      paddingTop: 28,
      gap: 20,
    },
    emptyWall: {
      opacity: 0.5,
    },
    emptyTitle: {
      fontFamily: typography.fontFamily.primary,
      fontSize: 30,
      fontWeight: typography.fontWeight.extrabold,
      letterSpacing: -0.025 * 30,
      lineHeight: 30 * 1.1,
      color: colors.text.primary,
    },
    emptyDesc: {
      fontSize: 16,
      color: colors.text.secondary,
      lineHeight: 16 * 1.55,
    },
    primaryButton: {
      height: 56,
      marginTop: 6,
      backgroundColor: colors.brand.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      fontFamily: mono,
      fontSize: 13,
      letterSpacing: 0.22 * 13,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.onBrand,
    },
    secondaryButton: {
      height: 56,
      marginTop: 6,
      borderWidth: 1,
      borderColor: colors.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      fontFamily: mono,
      fontSize: 13,
      letterSpacing: 0.22 * 13,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border.subtle,
      paddingTop: 16,
      height: 76,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
    },
    tabText: {
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: 0.16 * 10,
      color: colors.text.disabled,
    },
    tabTextActive: {
      fontFamily: mono,
      fontSize: 10,
      letterSpacing: 0.16 * 10,
      color: colors.brand.ink,
    },
  });
