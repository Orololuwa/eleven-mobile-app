import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field } from '@/components';
import { colors, typography, spacing } from '@/theme';
import type { PitchNearby, PitchRead } from '@/features/pitches/types';
import type { AttackDirection } from '@/features/sessions/types';

export type PitchSetupStep = 'source' | 'mark' | 'name' | 'similar' | 'kickoff';

type CornerKey = 'end_a_corner_1' | 'end_a_corner_2' | 'end_b_corner_1' | 'end_b_corner_2';

const CORNER_ORDER: CornerKey[] = [
  'end_a_corner_1',
  'end_a_corner_2',
  'end_b_corner_1',
  'end_b_corner_2',
];

const cornerLabel = (key: CornerKey) => {
  if (key.startsWith('end_a')) return 'HOME END';
  return 'AWAY END';
};

const cornerIndexInEnd = (key: CornerKey) => (key.endsWith('_1') ? 1 : 2);

type PitchSetupScreenProps = {
  sessionType: string;
  step: PitchSetupStep;
  markedCornerCount: number;
  gpsAccuracy: number | null;
  locationBusy?: boolean;
  nearbyPitch: PitchNearby | null;
  nearbyLoading?: boolean;
  pitchName: string;
  pitchNameError?: string;
  similarPitches: PitchRead[];
  selectedPitchName: string | null;
  skipHeatmap: boolean;
  attackDirection: AttackDirection;
  busy?: boolean;
  error?: string | null;
  onUseNearby: () => void;
  onDismissNearby: () => void;
  onUseSaved: () => void;
  onMarkNew: () => void;
  onSkip: () => void;
  onMarkCorner: () => void;
  onChangePitchName: (name: string) => void;
  onSubmitName: () => void;
  onSelectSimilar: (pitch: PitchRead) => void;
  onCreateAnyway: () => void;
  onFlipAttack: () => void;
  onKickOff: () => void;
  onBack: () => void;
};

export const PitchSetupScreen: React.FC<PitchSetupScreenProps> = ({
  sessionType,
  step,
  markedCornerCount,
  gpsAccuracy,
  locationBusy = false,
  nearbyPitch,
  nearbyLoading = false,
  pitchName,
  pitchNameError,
  similarPitches,
  selectedPitchName,
  skipHeatmap,
  attackDirection,
  busy = false,
  error = null,
  onUseNearby,
  onDismissNearby,
  onUseSaved,
  onMarkNew,
  onSkip,
  onMarkCorner,
  onChangePitchName,
  onSubmitName,
  onSelectSimilar,
  onCreateAnyway,
  onFlipAttack,
  onKickOff,
  onBack,
}) => {
  const [nameFocused, setNameFocused] = useState(false);
  const nextCorner = CORNER_ORDER[markedCornerCount];
  const attackingEndA = attackDirection === 'end_a';

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Text style={styles.backText}>◂ BACK</Text>
      </TouchableOpacity>

      {step === 'source' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.stepLabel}>PITCH SETUP</Text>
            <Text style={styles.headerTitle}>Where are you{'\n'}playing?</Text>
          </View>

          {nearbyLoading ? (
            <View style={styles.nearbyCard}>
              <ActivityIndicator color={colors.brand.primary} />
              <Text style={styles.nearbyMeta}>Checking for nearby pitches…</Text>
            </View>
          ) : null}

          {nearbyPitch ? (
            <View style={styles.nearbyCard}>
              <Text style={styles.nearbyLabel}>NEARBY</Text>
              <Text style={styles.nearbyTitle}>
                You&apos;re near {nearbyPitch.name} — use this?
              </Text>
              <Text style={styles.nearbyMeta}>
                {Math.round(nearbyPitch.distance_meters)} M AWAY
              </Text>
              <View style={styles.nearbyActions}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onUseNearby}
                  disabled={busy}
                >
                  <Text style={styles.primaryButtonText}>USE THIS PITCH</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDismissNearby} style={styles.skipButton}>
                  <Text style={styles.skipText}>NOT THIS ONE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Text style={styles.hint}>
              Mark Home and Away ends for a heatmap, reuse a saved ground, or skip and track without
              ends.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onMarkNew}
              disabled={busy || locationBusy}
            >
              <Text style={styles.primaryButtonText}>
                {locationBusy ? 'GETTING LOCATION…' : 'MARK NEW PITCH'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.savedButton} onPress={onUseSaved}>
              <Text style={styles.savedButtonText}>USE SAVED PITCH</Text>
              <Text style={styles.savedButtonMeta}>YOUR LIST</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>SKIP — TRACK WITHOUT A HEATMAP</Text>
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </ScrollView>
      ) : null}

      {step === 'mark' && nextCorner ? (
        <>
          <View style={styles.header}>
            <Text style={styles.stepLabel}>
              MARK · {cornerLabel(nextCorner)} · CORNER {cornerIndexInEnd(nextCorner)} OF 2
            </Text>
            <Text style={styles.headerTitle}>
              Walk to {cornerLabel(nextCorner).toLowerCase()}
              {'\n'}corner {cornerIndexInEnd(nextCorner)} and mark it.
            </Text>
          </View>

          <View style={styles.pitchContainer}>
            <Text style={styles.pitchPlaceholder}>[ SCHEMATIC ]</Text>
            <View style={styles.pitchOutline} />
            <View style={[styles.endLabel, styles.endLabelA]}>
              <Text style={styles.endLabelText}>END A</Text>
            </View>
            <View style={[styles.endLabel, styles.endLabelB]}>
              <Text style={styles.endLabelText}>END B</Text>
            </View>
            {CORNER_ORDER.map((key, index) => {
              const marked = index < markedCornerCount;
              const posStyle =
                key === 'end_a_corner_1'
                  ? styles.cornerTL
                  : key === 'end_a_corner_2'
                    ? styles.cornerTR
                    : key === 'end_b_corner_1'
                      ? styles.cornerBL
                      : styles.cornerBR;
              return (
                <View key={key} style={[styles.corner, posStyle]}>
                  <CornerMarker number={index + 1} marked={marked} />
                </View>
              );
            })}
            <Text style={styles.gpsLabel}>
              {gpsAccuracy != null ? `GPS ±${gpsAccuracy.toFixed(1)} M` : 'GPS'}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>CORNERS</Text>
              <Text style={[styles.statValue, { color: colors.brand.primary }]}>
                {markedCornerCount} / 4
              </Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>CURRENT</Text>
              <Text style={styles.statValueSmall}>
                {cornerLabel(nextCorner)} · {cornerIndexInEnd(nextCorner)}
              </Text>
            </View>
          </View>

          <View style={styles.spacer} />
          <View style={styles.actions}>
            <Text style={styles.hint}>
              Stand on the corner, then mark. Heatmaps need honest Home and Away ends geometry.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onMarkCorner}
              disabled={busy || locationBusy}
            >
              <Text style={styles.primaryButtonText}>
                {locationBusy
                  ? 'READING GPS…'
                  : `MARK ${cornerLabel(nextCorner)} · ${cornerIndexInEnd(nextCorner)}`}
              </Text>
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </>
      ) : null}

      {step === 'name' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.stepLabel}>NAME THIS PITCH</Text>
            <Text style={styles.headerTitle}>What do you call{'\n'}this ground?</Text>
          </View>
          <View style={styles.section}>
            <Field
              label="Pitch name"
              value={pitchName}
              onChangeText={onChangePitchName}
              placeholder="e.g. Lekki Astro"
              focused={nameFocused}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              error={pitchNameError}
              autoCapitalize="words"
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.spacer} />
          <View style={styles.actions}>
            <Button title="Continue" onPress={onSubmitName} size="large" disabled={busy} />
          </View>
        </ScrollView>
      ) : null}

      {step === 'similar' ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.stepLabel}>SIMILAR PITCH</Text>
            <Text style={styles.headerTitle}>A pitch matching{'\n'}this location exists.</Text>
          </View>
          <Text style={styles.hintPadded}>
            Select an existing pitch, or create yours anyway. This is a suggestion, not a block.
          </Text>
          <View style={styles.similarList}>
            {similarPitches.map((pitch) => (
              <TouchableOpacity
                key={pitch.id}
                style={styles.similarCard}
                onPress={() => onSelectSimilar(pitch)}
                disabled={busy}
              >
                <Text style={styles.similarTitle}>{pitch.name}</Text>
                <Text style={styles.similarMeta}>{pitch.visibility.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onCreateAnyway} disabled={busy}>
              <Text style={styles.primaryButtonText}>
                {busy ? 'CREATING…' : 'CREATE NEW ANYWAY'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}

      {step === 'kickoff' ? (
        <>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.stepLabel}>
                {skipHeatmap ? 'READY · NO HEATMAP' : 'KICKOFF · ATTACK'}
              </Text>
              <Text style={styles.headerTitle}>
                {skipHeatmap ? 'Track without a\nheatmap.' : 'Which end are you\nattacking?'}
              </Text>
            </View>

            {!skipHeatmap ? (
              <>
                <View style={styles.directionPitch}>
                  <View style={styles.centreLine} />
                  <View style={styles.centreCircle} />
                  <View style={[styles.goalBox, styles.goalBoxLeft]} />
                  <View style={[styles.goalBox, styles.goalBoxRight]} />
                  <View
                    style={[
                      styles.goalPost,
                      styles.goalPostLeft,
                      {
                        backgroundColor: attackingEndA
                          ? colors.brand.primary
                          : 'rgba(242,241,236,0.16)',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.goalPost,
                      styles.goalPostRight,
                      {
                        backgroundColor: attackingEndA
                          ? 'rgba(242,241,236,0.16)'
                          : colors.brand.primary,
                      },
                    ]}
                  />
                  <Text style={[styles.directionArrows, { color: colors.brand.primary }]}>
                    {attackingEndA ? '◀◀◀' : '▶▶▶'}
                  </Text>
                  <Text
                    style={[
                      styles.attackingLabel,
                      attackingEndA ? styles.labelLeft : styles.labelRight,
                    ]}
                  >
                    ATTACKING · {attackingEndA ? 'HOME END' : 'AWAY END'}
                  </Text>
                  <Text
                    style={[
                      styles.defendingLabel,
                      attackingEndA ? styles.labelRight : styles.labelLeft,
                    ]}
                  >
                    DEFENDING
                  </Text>
                </View>
                <View style={styles.flipContainer}>
                  <TouchableOpacity style={styles.flipButton} onPress={onFlipAttack}>
                    <Text style={styles.flipButtonText}>⇄ FLIP END</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <Text style={styles.hintPadded}>
                No corners, no attack direction. You can still track distance and time.
              </Text>
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.kickOffActions}>
            <Text style={styles.savedPitchMeta}>
              {skipHeatmap
                ? 'NO PITCH · NO HEATMAP'
                : selectedPitchName
                  ? `SAVED AS · ${selectedPitchName.toUpperCase()}`
                  : 'PITCH READY'}
            </Text>
            <TouchableOpacity
              style={[styles.kickOffButton, busy && styles.kickOffButtonDisabled]}
              onPress={onKickOff}
              disabled={busy}
            >
              <Text style={styles.kickOffLabel}>{busy ? 'STARTING…' : 'KICK OFF'}</Text>
              <Text style={styles.kickOffSub}>{sessionType.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
};

const CornerMarker: React.FC<{ number: number; marked: boolean }> = ({ number, marked }) => (
  <View
    style={[styles.cornerMarker, marked ? styles.cornerMarkerFilled : styles.cornerMarkerEmpty]}
  >
    <Text
      style={[styles.cornerNumber, marked ? styles.cornerNumberFilled : styles.cornerNumberEmpty]}
    >
      {number}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  backRow: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  backText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.text.secondary,
  },
  header: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
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
  nearbyCard: {
    marginHorizontal: spacing[6],
    marginBottom: spacing[5],
    padding: 18,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: `${colors.brand.primary}10`,
    gap: 8,
  },
  nearbyLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.brand.primary,
  },
  nearbyTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  nearbyMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  nearbyActions: { gap: 10, marginTop: 8 },
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
  endLabel: { position: 'absolute', zIndex: 2 },
  endLabelA: { top: 12, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  endLabelB: { bottom: 12, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  endLabelText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.brand.primary,
  },
  corner: { position: 'absolute', width: 24, height: 24, zIndex: 2 },
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
  cornerMarkerFilled: { backgroundColor: colors.brand.primary },
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
  cornerNumberFilled: { color: colors.background.secondary },
  cornerNumberEmpty: { color: colors.brand.primary },
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
  statValueSmall: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 16,
    color: colors.text.primary,
  },
  spacer: { flex: 1 },
  section: { paddingHorizontal: spacing[6], gap: 14 },
  actions: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[9],
    gap: 12,
  },
  hint: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
  hintPadded: {
    paddingHorizontal: spacing[6],
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
    marginBottom: spacing[5],
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
  skipButton: { paddingVertical: 6, alignItems: 'center' },
  skipText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
  },
  similarList: { paddingHorizontal: spacing[6], gap: 10, marginBottom: spacing[6] },
  similarCard: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 18,
    gap: 6,
  },
  similarTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  similarMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
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
  goalBoxLeft: { left: 0, borderLeftWidth: 0 },
  goalBoxRight: { right: 0, borderRightWidth: 0 },
  goalPost: {
    position: 'absolute',
    top: '50%',
    width: 10,
    height: 38,
    marginTop: -19,
  },
  goalPostLeft: { left: 0 },
  goalPostRight: { right: 0 },
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
  kickOffActions: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
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
  kickOffButtonDisabled: { opacity: 0.6 },
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
  error: {
    paddingHorizontal: spacing[6],
    fontSize: 14,
    color: colors.accent.danger,
  },
});
