import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, StatTile, Wall } from '../components';
import { colors, typography, spacing } from '../theme';

type SessionSummaryScreenProps = {
  sessionData: {
    title: string;
    date: string;
    location: string;
    type: string;
    brickNumber: number;
    distance: number;
    topSpeed: number;
    sprints: number;
    calories: number;
    duration: number;
    isNewRecord?: boolean;
  };
  totalBricks: number;
  onShare: () => void;
  onDone: () => void;
};

export const SessionSummaryScreen: React.FC<SessionSummaryScreenProps> = ({
  sessionData,
  totalBricks,
  onShare,
  onDone,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brickLabel}>BRICK {sessionData.brickNumber} LAID</Text>
          <Text style={styles.title}>{sessionData.title.toUpperCase()}</Text>
          <Text style={styles.subtitle}>
            {sessionData.date} · {sessionData.location} · {sessionData.type}
          </Text>
        </View>

        {/* Hero Stat */}
        <View style={styles.heroSection}>
          <StatTile
            label={`Distance Covered · +0.6 vs Average`}
            value={sessionData.distance}
            subtitle="KM"
            isHero
          />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <StatTile
              label="Top Speed"
              value={sessionData.topSpeed}
              subtitle={sessionData.isNewRecord ? 'NEW PERSONAL BEST' : undefined}
              isRecord={sessionData.isNewRecord}
              style={styles.statTile}
            />
            <StatTile
              label="Sprints"
              value={sessionData.sprints}
              subtitle="Most in 4 weeks"
              style={styles.statTile}
            />
            <StatTile
              label="Calories"
              value={sessionData.calories}
              subtitle="KCAL"
              style={styles.statTile}
            />
            <StatTile
              label="Duration"
              value={sessionData.duration}
              subtitle="MINUTES"
              style={styles.statTile}
            />
          </View>
        </View>

        {/* The Wall */}
        <View style={styles.wallSection}>
          <Text style={styles.wallLabel}>THE WALL · {totalBricks} BRICKS</Text>
          <Wall total={56} built={totalBricks} />
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="Share Match Card" onPress={onShare} size="large" />
        <Button title="Done" onPress={onDone} variant="ghost" />
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
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
    gap: 8,
  },
  brickLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.24 * 11,
    color: colors.brand.primary,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 34,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 34,
    lineHeight: 34,
    color: colors.text.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  heroSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[7],
  },
  statsSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[7],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    backgroundColor: colors.border.subtle,
  },
  statTile: {
    width: '49.5%',
  },
  wallSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    flex: 1,
    gap: 10,
  },
  wallLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[9],
    gap: 10,
  },
});
