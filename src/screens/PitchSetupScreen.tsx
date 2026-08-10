import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';

type PitchSetupScreenProps = {
  sessionType: string;
  onComplete: () => void;
  onSkip: () => void;
};

const CORNERS = [1, 2, 3, 4];

export const PitchSetupScreen: React.FC<PitchSetupScreenProps> = ({
  sessionType,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [markedCorners, setMarkedCorners] = useState<number[]>([1, 2, 3]);
  const [attackRight, setAttackRight] = useState(true);
  const [autoSwap, setAutoSwap] = useState(true);

  const nextCorner = CORNERS.find((c) => !markedCorners.includes(c));

  const handleMarkCorner = () => {
    if (nextCorner !== undefined) {
      const updated = [...markedCorners, nextCorner];
      setMarkedCorners(updated);
      if (updated.length === 4) {
        setStep(2);
      }
    }
  };

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.time}>10:22</Text>
          <Text style={styles.statusIcons}>▮▮▮ ⌁ ▰</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepLabel}>STEP 1 OF 2 · PITCH</Text>
          <Text style={styles.headerTitle}>Walk to each corner{'\n'}and mark it.</Text>
        </View>

        {/* Pitch Map */}
        <View style={styles.pitchContainer}>
          <Text style={styles.pitchPlaceholder}>[ SATELLITE MAP ]</Text>

          {/* Pitch outline */}
          <View style={styles.pitchOutline} />

          {/* Corner markers */}
          <View style={[styles.corner, styles.cornerTL]}>
            <CornerMarker number={1} marked={markedCorners.includes(1)} />
          </View>
          <View style={[styles.corner, styles.cornerTR]}>
            <CornerMarker number={2} marked={markedCorners.includes(2)} />
          </View>
          <View style={[styles.corner, styles.cornerBR]}>
            <CornerMarker number={3} marked={markedCorners.includes(3)} />
          </View>
          <View style={[styles.corner, styles.cornerBL]}>
            <CornerMarker number={4} marked={markedCorners.includes(4)} />
          </View>

          {/* Player dot */}
          <View style={styles.playerDot} />
          <View style={styles.playerPulse} />

          <Text style={styles.gpsLabel}>GPS ±2.1 M</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>CORNERS</Text>
            <Text style={[styles.statValue, { color: colors.brand.primary }]}>
              {markedCorners.length} / 4
            </Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>PITCH SIZE</Text>
            <Text style={styles.statValue}>
              {markedCorners.length >= 4 ? '64 × 42' : '— × —'}
              <Text style={styles.statUnit}> M</Text>
            </Text>
          </View>
        </View>

        <View style={styles.spacer} />

        {/* Bottom Actions */}
        <View style={styles.actions}>
          <Text style={styles.hint}>
            Stand on the corner flag, then mark. Your heatmap is only as honest as these four points.
          </Text>

          {nextCorner ? (
            <TouchableOpacity style={styles.primaryButton} onPress={handleMarkCorner}>
              <Text style={styles.primaryButtonText}>MARK CORNER {nextCorner}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
              <Text style={styles.primaryButtonText}>CONTINUE</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.savedButton}>
            <Text style={styles.savedButtonText}>USE SAVED · LEKKI ASTRO</Text>
            <Text style={styles.savedButtonMeta}>12 SESSIONS</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>SKIP — TRACK WITHOUT A HEATMAP</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.time}>10:23</Text>
          <Text style={styles.statusIcons}>▮▮▮ ⌁ ▰</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepLabel}>STEP 2 OF 2 · DIRECTION</Text>
          <Text style={styles.headerTitle}>Which way are{'\n'}you attacking?</Text>
        </View>

        {/* Direction Pitch */}
        <View style={styles.directionPitch}>
          <View style={styles.centreLine} />
          <View style={styles.centreCircle} />
          <View style={[styles.goalBox, styles.goalBoxLeft]} />
          <View style={[styles.goalBox, styles.goalBoxRight]} />
          <View
            style={[
              styles.goalPost,
              styles.goalPostLeft,
              { backgroundColor: attackRight ? 'rgba(242,241,236,0.16)' : colors.brand.primary },
            ]}
          />
          <View
            style={[
              styles.goalPost,
              styles.goalPostRight,
              { backgroundColor: attackRight ? colors.brand.primary : 'rgba(242,241,236,0.16)' },
            ]}
          />
          <Text style={[styles.directionArrows, { color: colors.brand.primary }]}>
            {attackRight ? '▶▶▶' : '◀◀◀'}
          </Text>
          <Text style={[styles.attackingLabel, attackRight ? styles.labelRight : styles.labelLeft]}>
            ATTACKING
          </Text>
          <Text style={[styles.defendingLabel, attackRight ? styles.labelLeft : styles.labelRight]}>
            DEFENDING
          </Text>
        </View>

        {/* Flip Button */}
        <View style={styles.flipContainer}>
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => setAttackRight((v) => !v)}
          >
            <Text style={styles.flipButtonText}>⇄ FLIP DIRECTION</Text>
          </TouchableOpacity>
        </View>

        {/* Auto Swap */}
        <View style={styles.autoSwapSection}>
          <Text style={styles.autoSwapLabel}>AUTO-SWITCH AT HALF TIME</Text>
          <View style={styles.autoSwapCard}>
            <View style={styles.autoSwapText}>
              <Text style={styles.autoSwapTitle}>Swap ends automatically</Text>
              <Text style={styles.autoSwapDesc}>
                When you resume after a pause, Eleven flips the pitch. Override any time.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, autoSwap && styles.toggleOn]}
              onPress={() => setAutoSwap((v) => !v)}
            >
              <View style={[styles.toggleThumb, autoSwap && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* KICK OFF — pinned outside scroll so it's always visible */}
      <View style={styles.kickOffActions}>
        <Text style={styles.savedPitchMeta}>SAVED AS · LEKKI ASTRO · 64 × 42 M</Text>
        <TouchableOpacity style={styles.kickOffButton} onPress={onComplete}>
          <Text style={styles.kickOffLabel}>KICK OFF</Text>
          <Text style={styles.kickOffSub}>
            {sessionType.toUpperCase()} · BRICK 54
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const CornerMarker: React.FC<{ number: number; marked: boolean }> = ({ number, marked }) => (
  <View
    style={[
      styles.cornerMarker,
      marked ? styles.cornerMarkerFilled : styles.cornerMarkerEmpty,
    ]}
  >
    <Text style={[styles.cornerNumber, marked ? styles.cornerNumberFilled : styles.cornerNumberEmpty]}>
      {number}
    </Text>
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
  header: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[5],
    gap: 10,
  },
  stepLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.2 * 11,
    color: colors.brand.primary,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 30,
    fontWeight: typography.fontWeight.extrabold,
    letterSpacing: -0.025 * 30,
    lineHeight: 30 * 1.05,
    color: colors.text.primary,
  },
  pitchContainer: {
    marginHorizontal: spacing[6],
    height: 240,
    backgroundColor: 'rgba(16, 20, 16, 1)',
    borderWidth: 1,
    borderColor: colors.border.default,
    position: 'relative',
  },
  pitchPlaceholder: {
    position: 'absolute',
    top: 12,
    left: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.disabled,
  },
  pitchOutline: {
    position: 'absolute',
    top: 40,
    left: 36,
    right: 36,
    bottom: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(200,242,78,0.5)',
    backgroundColor: 'rgba(200,242,78,0.06)',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    zIndex: 2,
  },
  cornerTL: { top: 28, left: 24 },
  cornerTR: { top: 28, right: 24 },
  cornerBR: { bottom: 28, right: 24 },
  cornerBL: { bottom: 28, left: 24 },
  cornerMarker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerMarkerFilled: {
    backgroundColor: colors.brand.primary,
  },
  cornerMarkerEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.brand.primary,
  },
  cornerNumber: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    fontWeight: typography.fontWeight.semibold,
  },
  cornerNumberFilled: {
    color: colors.background.secondary,
  },
  cornerNumberEmpty: {
    color: colors.brand.primary,
  },
  playerPulse: {
    position: 'absolute',
    bottom: 46,
    left: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(200,242,78,0.35)',
    backgroundColor: 'rgba(200,242,78,0.12)',
  },
  playerDot: {
    position: 'absolute',
    bottom: 60,
    left: 34,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text.primary,
    borderWidth: 2,
    borderColor: colors.background.secondary,
    zIndex: 3,
  },
  gpsLabel: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.14 * 9,
    color: colors.text.secondary,
  },
  statsRow: {
    marginHorizontal: spacing[6],
    marginTop: 1,
    flexDirection: 'row',
    gap: 1,
    backgroundColor: colors.border.subtle,
  },
  statBlock: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    padding: spacing[4],
    paddingRight: 12,
    gap: 6,
  },
  statLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.secondary,
  },
  statValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 26,
    color: colors.text.primary,
  },
  statUnit: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  spacer: {
    flex: 1,
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[9],
    gap: 12,
  },
  kickOffActions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  hint: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
  primaryButton: {
    height: 64,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 15,
    letterSpacing: 0.22 * 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.background.secondary,
  },
  savedButton: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border.strong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  savedButtonText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.16 * 12,
    color: colors.text.primary,
  },
  savedButtonMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  skipButton: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
  },
  // Step 2: Direction
  directionPitch: {
    marginHorizontal: spacing[6],
    height: 180,
    backgroundColor: colors.background.pitch,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centreLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(242,241,236,0.28)',
  },
  centreCircle: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(242,241,236,0.28)',
  },
  goalBox: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 90,
    marginTop: -45,
    borderWidth: 1,
    borderColor: 'rgba(242,241,236,0.28)',
  },
  goalBoxLeft: {
    left: 0,
    borderLeftWidth: 0,
  },
  goalBoxRight: {
    right: 0,
    borderRightWidth: 0,
  },
  goalPost: {
    position: 'absolute',
    top: '50%',
    width: 10,
    height: 38,
    marginTop: -19,
  },
  goalPostLeft: {
    left: 0,
  },
  goalPostRight: {
    right: 0,
  },
  directionArrows: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 22,
    letterSpacing: 0.1 * 22,
    zIndex: 2,
  },
  attackingLabel: {
    position: 'absolute',
    top: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.brand.primary,
  },
  labelRight: { right: 14 },
  labelLeft: { left: 14 },
  defendingLabel: {
    position: 'absolute',
    top: 12,
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
  flipContainer: {
    paddingHorizontal: spacing[6],
    marginTop: spacing[4],
  },
  flipButton: {
    height: 56,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipButtonText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    letterSpacing: 0.2 * 13,
    color: colors.text.primary,
  },
  autoSwapSection: {
    paddingHorizontal: spacing[6],
    marginTop: spacing[7],
    gap: 12,
  },
  autoSwapLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
  autoSwapCard: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoSwapText: {
    flex: 1,
    marginRight: 16,
    gap: 6,
  },
  autoSwapTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  autoSwapDesc: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 13 * 1.45,
  },
  toggle: {
    width: 52,
    height: 30,
    backgroundColor: 'rgba(242,241,236,0.14)',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 3,
    flexShrink: 0,
  },
  toggleOn: {
    backgroundColor: colors.brand.primary,
    alignItems: 'flex-end',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    backgroundColor: colors.background.secondary,
  },
  toggleThumbOn: {
    backgroundColor: colors.background.secondary,
  },
  savedPitchMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
  },
  kickOffButton: {
    height: 72,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  kickOffLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 17,
    letterSpacing: 0.22 * 17,
    fontWeight: typography.fontWeight.semibold,
    color: colors.background.secondary,
  },
  kickOffSub: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.18 * 10,
    color: 'rgba(8,9,10,0.65)',
  },
});
