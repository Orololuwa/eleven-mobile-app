import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Wall, StatTile } from '@/components';
import { colors, typography, spacing } from '@/theme';

type HomeScreenProps = {
  userName: string;
  sessionCount: number;
  onStartSession: () => void;
  onNavigateToHistory: () => void;
  onNavigateToProfile: () => void;
  showEmptyWallBanner?: boolean;
  onFindWall?: () => void;
  weeklyStats?: {
    sessions: number;
    distance: number;
    minutes: number;
  };
  lastSession?: {
    title: string;
    date: string;
    location: string;
    type: string;
    distance: number;
    topSpeed: number;
  };
  streak?: number;
};

export const HomeScreen: React.FC<HomeScreenProps> = ({
  userName,
  sessionCount,
  onStartSession,
  onNavigateToHistory,
  onNavigateToProfile,
  showEmptyWallBanner = false,
  onFindWall,
  weeklyStats,
  lastSession,
  streak,
}) => {
  const isFirstTime = sessionCount === 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerSubtitle}>PROJECT //</Text>
            <Text style={styles.headerTitle}>{userName.toUpperCase()}</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={onNavigateToProfile}>
            <View style={styles.avatarPlaceholder} />
          </TouchableOpacity>
        </View>

        {showEmptyWallBanner && onFindWall ? (
          <TouchableOpacity style={styles.emptyWallBanner} onPress={onFindWall}>
            <View style={styles.emptyWallCopy}>
              <Text style={styles.emptyWallTitle}>EMPTY WALL?</Text>
              <Text style={styles.emptyWallBody}>
                Played before? Apple sign-in starts a new account.
              </Text>
            </View>
            <Text style={styles.emptyWallChevron}>▸</Text>
          </TouchableOpacity>
        ) : null}

        {/* Main Content */}
        <View style={styles.main}>
          {/* Hero Title */}
          <View style={styles.heroSection}>
            {isFirstTime ? (
              <Text style={styles.heroTitle}>Day one.{'\n'}Lay the first brick.</Text>
            ) : (
              <View style={styles.heroRow}>
                <Text style={styles.heroTitle}>Sunday again.</Text>
                {streak && <Text style={styles.heroStreak}>{streak}-WEEK STREAK</Text>}
              </View>
            )}
          </View>

          {/* Start Session Button   */}
          <Button
            title={isFirstTime ? 'Start Session' : 'Start Session'}
            onPress={onStartSession}
            size="large"
            style={styles.startButton}
          />
          {!isFirstTime && <Text style={styles.startButtonSubtitle}>BRICK {sessionCount + 1}</Text>}

          {/* The Wall */}
          <View style={styles.wallSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>THE WALL</Text>
              {!isFirstTime && <Text style={styles.sectionValue}>{sessionCount} BRICKS</Text>}
            </View>
            <Wall total={56} built={sessionCount} />
            {isFirstTime && (
              <Text style={styles.wallDescription}>
                Every session lays a brick. It never resets — it only gets longer.
              </Text>
            )}
          </View>

          {/* Last Session */}
          {lastSession && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LAST SESSION</Text>
              <TouchableOpacity style={styles.sessionCard}>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionTitle}>{lastSession.title}</Text>
                  <Text style={styles.sessionSubtitle}>
                    {lastSession.date} · {lastSession.location} · {lastSession.type}
                  </Text>
                </View>
                <View style={styles.sessionStats}>
                  <View style={styles.sessionStat}>
                    <Text style={styles.sessionStatLabel}>KM</Text>
                    <Text style={styles.sessionStatValue}>{lastSession.distance}</Text>
                  </View>
                  <View style={styles.sessionStat}>
                    <Text style={styles.sessionStatLabel}>TOP</Text>
                    <Text style={[styles.sessionStatValue, styles.sessionStatAccent]}>
                      {lastSession.topSpeed}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Weekly Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>THIS WEEK</Text>
            <View style={styles.statsGrid}>
              <StatTile
                label="Sessions"
                value={weeklyStats?.sessions ?? 0}
                style={styles.statTile}
              />
              <StatTile
                label="Distance"
                value={weeklyStats?.distance ?? 0.0}
                style={styles.statTile}
              />
              <StatTile label="Minutes" value={weeklyStats?.minutes ?? 0} style={styles.statTile} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabTextActive}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={onNavigateToHistory}>
          <Text style={styles.tabText}>HISTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={onNavigateToProfile}>
          <Text style={styles.tabText}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    paddingBottom: spacing[5],
  },
  headerLeft: {
    gap: 4,
  },
  headerSubtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.34 * 10,
    color: colors.brand.primary,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 26,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.03 * 26,
    lineHeight: 26,
    color: colors.text.primary,
  },
  avatar: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.secondary,
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  emptyWallBanner: {
    marginHorizontal: spacing[6],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyWallCopy: {
    flex: 1,
    gap: 6,
  },
  emptyWallTitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.brand.primary,
  },
  emptyWallBody: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    lineHeight: 14 * 1.4,
    color: colors.text.secondary,
  },
  emptyWallChevron: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 16,
    color: colors.text.secondary,
  },
  main: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    gap: 14,
  },
  heroSection: {
    marginBottom: 0,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexWrap: 'wrap',
  },
  heroTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 30,
    fontWeight: typography.fontWeight.extrabold,
    letterSpacing: -0.025 * 30,
    lineHeight: 30 * 1.05,
    color: colors.text.primary,
  },
  heroStreak: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.12 * 12,
    color: colors.brand.primary,
  },
  startButton: {
    height: 112,
    backgroundColor: colors.brand.primary,
  },
  startButtonSubtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: -6,
  },
  wallSection: {
    marginTop: 12,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
  sectionValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.brand.primary,
  },
  wallDescription: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
  section: {
    marginTop: 10,
    gap: 12,
  },
  sessionCard: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    gap: 6,
    flex: 1,
  },
  sessionTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  sessionSubtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 20,
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
    fontSize: 20,
    color: colors.text.primary,
  },
  sessionStatAccent: {
    color: colors.brand.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.border.subtle,
  },
  statTile: {
    flex: 1,
    padding: 16,
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
