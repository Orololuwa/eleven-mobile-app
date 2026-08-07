import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wall } from '../components';
import { colors, typography, spacing } from '../theme';

type Session = {
  id: string;
  title: string;
  date: string;
  location: string;
  type: 'MATCH' | 'TRAINING' | 'FUTSAL';
  distance: number;
  topSpeed: number;
};

type HistoryScreenProps = {
  sessions: Session[];
  onSelectSession: (session: Session) => void;
  onStartSession: () => void;
  onNavigateToHome: () => void;
  onNavigateToProfile: () => void;
};

const MOCK_SESSIONS: Session[] = [
  { id: '1', title: 'Sunday Match', date: '09 AUG', location: 'LEKKI', type: 'MATCH', distance: 8.4, topSpeed: 31.2 },
  { id: '2', title: 'Evening Training', date: '07 AUG', location: 'SURULERE', type: 'TRAINING', distance: 5.1, topSpeed: 24.6 },
  { id: '3', title: 'Futsal Night', date: '05 AUG', location: 'IKOYI', type: 'FUTSAL', distance: 3.8, topSpeed: 26.1 },
  { id: '4', title: 'Sunday Match', date: '02 AUG', location: 'LEKKI', type: 'MATCH', distance: 7.9, topSpeed: 30.4 },
  { id: '5', title: 'Sprint Work', date: '31 JUL', location: 'YABA', type: 'TRAINING', distance: 4.2, topSpeed: 29.8 },
];

// Days of month that have sessions (for the grid)
const SESSION_DAYS = [2, 5, 7, 9];

const FILTERS = ['ALL', 'MATCH', 'TRAINING', 'FUTSAL'] as const;
type Filter = typeof FILTERS[number];

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  sessions,
  onSelectSession,
  onStartSession,
  onNavigateToHome,
  onNavigateToProfile,
}) => {
  const [activeFilter, setActiveFilter] = useState<Filter>('ALL');

  const allSessions = sessions.length > 0 ? sessions : MOCK_SESSIONS;
  const isEmpty = sessions.length === 0 && allSessions === MOCK_SESSIONS ? false : sessions.length === 0;

  const filtered = activeFilter === 'ALL'
    ? allSessions
    : allSessions.filter((s) => s.type === activeFilter);

  if (isEmpty) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusBar}>
          <Text style={styles.time}>9:41</Text>
          <Text style={styles.statusIcons}>▮▮▮ ⌁ ▰</Text>
        </View>
        <View style={styles.emptyHeader}>
          <Text style={styles.screenTitle}>History</Text>
        </View>
        <View style={styles.emptyBody}>
          <View style={styles.emptyWall}>
            <Wall total={56} built={0} />
          </View>
          <Text style={styles.emptyTitle}>
            Nothing here yet —{'\n'}and that's the point.
          </Text>
          <Text style={styles.emptyDesc}>
            Your history starts the first time you press Start Session. Match, training or futsal — it all counts.
          </Text>
          <TouchableOpacity style={styles.startFirstButton} onPress={onStartSession}>
            <Text style={styles.startFirstText}>START YOUR FIRST</Text>
          </TouchableOpacity>
        </View>
        <TabBar active="HISTORY" onHome={onNavigateToHome} onProfile={onNavigateToProfile} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBar}>
        <Text style={styles.time}>9:41</Text>
        <Text style={styles.statusIcons}>▮▮▮ ⌁ ▰</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Header */}
        <View style={styles.listHeader}>
          <Text style={styles.screenTitle}>History</Text>
          <Text style={styles.sessionCount}>{allSessions.length} SESSIONS</Text>
        </View>

        {/* Filter Chips */}
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, activeFilter === f && styles.chipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Month Grid */}
        <View style={styles.monthSection}>
          <Text style={styles.monthLabel}>AUGUST 2026</Text>
          <MonthGrid sessionDays={SESSION_DAYS} />
        </View>

        {/* Session List */}
        <View style={styles.sessionList}>
          {filtered.map((session, i) => (
            <TouchableOpacity
              key={session.id}
              style={[styles.sessionRow, i > 0 && styles.sessionRowBorder]}
              onPress={() => onSelectSession(session)}
            >
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <Text style={styles.sessionMeta}>
                  {session.date} · {session.location} · {session.type}
                </Text>
              </View>
              <View style={styles.sessionStats}>
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatLabel}>KM</Text>
                  <Text style={styles.sessionStatValue}>{session.distance}</Text>
                </View>
                <View style={styles.sessionStat}>
                  <Text style={styles.sessionStatLabel}>TOP</Text>
                  <Text style={[styles.sessionStatValue, styles.sessionStatAccent]}>
                    {session.topSpeed}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TabBar active="HISTORY" onHome={onNavigateToHome} onProfile={onNavigateToProfile} />
    </SafeAreaView>
  );
};

const MonthGrid: React.FC<{ sessionDays: number[] }> = ({ sessionDays }) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <View style={styles.monthGrid}>
      {days.map((day) => {
        const hasSession = sessionDays.includes(day);
        return (
          <View
            key={day}
            style={[styles.dayCell, hasSession && styles.dayCellActive]}
          />
        );
      })}
    </View>
  );
};

const TabBar: React.FC<{
  active: string;
  onHome: () => void;
  onProfile: () => void;
}> = ({ active, onHome, onProfile }) => (
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  statusBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
  },
  time: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: colors.text.primary,
  },
  statusIcons: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.text.secondary,
  },
  scroll: {
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: spacing[6],
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
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.brand.primary,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border.medium,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  chipText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  chipTextActive: {
    color: colors.background.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
  monthSection: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[5],
    gap: 10,
  },
  monthLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayCell: {
    width: 14,
    height: 14,
    backgroundColor: 'rgba(242,241,236,0.10)',
  },
  dayCellActive: {
    backgroundColor: colors.brand.primary,
  },
  sessionList: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  sessionRow: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[6],
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  sessionInfo: {
    flex: 1,
    gap: 6,
  },
  sessionTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sessionMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 22,
  },
  sessionStat: {
    alignItems: 'flex-end',
    gap: 4,
  },
  sessionStatLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    color: colors.text.secondary,
    letterSpacing: 0.14 * 9,
  },
  sessionStatValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 19,
    color: colors.text.primary,
    letterSpacing: -0.02 * 19,
  },
  sessionStatAccent: {
    color: colors.brand.primary,
  },
  // Empty state
  emptyHeader: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
  },
  emptyBody: {
    flex: 1,
    paddingHorizontal: spacing[6],
    justifyContent: 'center',
    gap: 26,
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
  startFirstButton: {
    height: 56,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startFirstText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    letterSpacing: 0.22 * 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.background.secondary,
  },
  // Tab bar
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
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
  },
  tabTextActive: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.brand.primary,
  },
});
