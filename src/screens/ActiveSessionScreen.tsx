import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Button, StatusPill } from '../components';
import { colors, typography, spacing } from '../theme';

type ActiveSessionScreenProps = {
  sessionType: string;
  onPause: () => void;
  onEnd: () => void;
};

export const ActiveSessionScreen: React.FC<ActiveSessionScreenProps> = ({
  sessionType,
  onPause,
  onEnd,
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [topSpeed, setTopSpeed] = useState(0);
  const [sprints, setSprints] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);

  // Simulate timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
      // Simulate other metrics incrementing
      setDistance((prev) => prev + 0.01);
      if (Math.random() > 0.95) {
        setTopSpeed(Math.max(topSpeed, 20 + Math.random() * 15));
      }
      if (Math.random() > 0.98) {
        setSprints((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [topSpeed]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentPace = distance > 0 ? formatTime(Math.floor(elapsed / distance)) : '0:00';

  // Generate mock speed trace
  const generateTrace = () => {
    return Array.from({ length: 40 }).map((_, i) => {
      const height = Math.random() * 80 + 20;
      return (
        <View
          key={i}
          style={[
            styles.traceBar,
            {
              height,
              backgroundColor:
                height > 80
                  ? colors.brand.primary
                  : colors.border.strong,
            },
          ]}
        />
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <StatusPill label={`LIVE · ${sessionType.toUpperCase()}`} status="live" />
          <Text style={styles.gpsStatus}>GPS ▮▮▮ STRONG</Text>
        </View>

        {/* Elapsed Time */}
        <View style={styles.timeSection}>
          <Text style={styles.timeLabel}>ELAPSED</Text>
          <Text style={styles.timeValue}>{formatTime(elapsed)}</Text>
        </View>

        {/* Primary Stats */}
        <View style={styles.primaryStats}>
          <View style={styles.primaryStat}>
            <Text style={styles.primaryStatLabel}>DISTANCE</Text>
            <Text style={styles.primaryStatValue}>
              {distance.toFixed(1)}
              <Text style={styles.primaryStatUnit}> KM</Text>
            </Text>
          </View>
          <View style={[styles.primaryStat, styles.primaryStatBorder]}>
            <Text style={styles.primaryStatLabel}>PACE</Text>
            <Text style={styles.primaryStatValue}>
              {currentPace}
              <Text style={styles.primaryStatUnit}> /KM</Text>
            </Text>
          </View>
        </View>

        {/* Speed Trace */}
        <View style={styles.traceSection}>
          <View style={styles.traceSectionHeader}>
            <Text style={styles.traceLabel}>SPEED TRACE</Text>
            <Text style={styles.traceTopSpeed}>TOP {topSpeed.toFixed(1)} KM/H</Text>
          </View>
          <View style={styles.trace}>{generateTrace()}</View>
          <View style={styles.secondaryStats}>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatLabel}>SPRINTS</Text>
              <Text style={styles.secondaryStatValue}>{sprints}</Text>
            </View>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatLabel}>KCAL</Text>
              <Text style={styles.secondaryStatValue}>{Math.floor(elapsed * 8.5)}</Text>
            </View>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatLabel}>AVG</Text>
              <Text style={styles.secondaryStatValue}>
                {distance > 0 ? ((elapsed / 60) / distance).toFixed(1) : '0.0'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Pause — Half Time"
          onPress={onPause}
          variant="secondary"
        />
        <TouchableOpacity
          style={styles.endButton}
          onPressIn={() => {
            const interval = setInterval(() => {
              setHoldProgress((prev) => {
                if (prev >= 100) {
                  clearInterval(interval);
                  onEnd();
                  return 0;
                }
                return prev + 3.33; // 3 second hold
              });
            }, 100);
          }}
          onPressOut={() => setHoldProgress(0)}
          activeOpacity={1}
        >
          <View
            style={[
              styles.endButtonProgress,
              { width: `${holdProgress}%` },
            ]}
          />
          <Text style={styles.endButtonText}>HOLD TO END SESSION</Text>
        </TouchableOpacity>
        <Text style={styles.endButtonHint}>
          HOLD 3 SECONDS · NO ACCIDENTAL STOPS
        </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpsStatus: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  timeSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[11],
    gap: 6,
  },
  timeLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.text.secondary,
  },
  timeValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 82,
    lineHeight: 82,
    letterSpacing: -0.03 * 82,
    color: colors.text.primary,
  },
  primaryStats: {
    marginTop: spacing[9],
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.border.subtle,
  },
  primaryStat: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 8,
    gap: 8,
  },
  primaryStatBorder: {
    paddingLeft: 20,
  },
  primaryStatLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.text.secondary,
  },
  primaryStatValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -0.03 * 44,
    color: colors.text.primary,
  },
  primaryStatUnit: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  traceSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    flex: 1,
    gap: 18,
  },
  traceSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  traceLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.text.secondary,
  },
  traceTopSpeed: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: colors.brand.primary,
  },
  trace: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 120,
  },
  traceBar: {
    flex: 1,
  },
  secondaryStats: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.border.subtle,
    marginTop: 4,
  },
  secondaryStat: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    padding: 14,
    gap: 6,
  },
  secondaryStatLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.secondary,
  },
  secondaryStatValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 22,
    color: colors.text.primary,
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    paddingBottom: spacing[9],
    gap: 12,
  },
  endButton: {
    height: 72,
    borderWidth: 2,
    borderColor: colors.accent.danger,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  endButtonProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: `${colors.accent.danger}22`,
  },
  endButtonText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    letterSpacing: 0.22 * 14,
    color: colors.accent.danger,
    fontWeight: typography.fontWeight.semibold,
    position: 'relative',
  },
  endButtonHint: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
  },
});
