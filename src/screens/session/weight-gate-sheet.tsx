import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Chip } from '@/components';
import { colors, spacing, typography } from '@/theme';
import { SEX_OPTIONS, type Sex } from '@/features/profile/types';
import {
  displayToKg,
  formatWeight,
  formatWeightUpdated,
  kgToDisplay,
  sexLabel,
  weightUnitLabel,
  type WeightGateMode,
} from '@/features/profile/weight';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG, roundWeightKg } from '@/features/profile/validation';

type WeightGateSheetProps = {
  visible: boolean;
  mode: WeightGateMode;
  sexMissing: boolean;
  massUnit: 'kg' | 'lb';
  savedWeightKg: number | null;
  weightUpdatedAt: string | null;
  busy?: boolean;
  error?: string | null;
  onDismiss: () => void;
  onSave: (update: { weightKg: number; sex: Sex | null }) => void;
};

const stepDisplay = (unit: 'kg' | 'lb') => (unit === 'lb' ? 1 : 0.5);

export const WeightGateSheet: React.FC<WeightGateSheetProps> = ({
  visible,
  mode,
  sexMissing,
  massUnit,
  savedWeightKg,
  weightUpdatedAt,
  busy = false,
  error = null,
  onDismiss,
  onSave,
}) => {
  const [weightKg, setWeightKg] = useState<number | null>(mode === 'stale' ? savedWeightKg : null);
  const [sex, setSex] = useState<Sex | null>(null);
  const updated = formatWeightUpdated(weightUpdatedAt);
  const unit = weightUnitLabel(massUnit);
  const shown = weightKg == null ? '— —' : formatWeight(weightKg, massUnit);
  const unchanged =
    mode === 'stale' &&
    savedWeightKg != null &&
    weightKg != null &&
    roundWeightKg(weightKg) === roundWeightKg(savedWeightKg);
  const canSave = weightKg != null && !busy;

  const nudge = (direction: 1 | -1) => {
    const current = weightKg ?? savedWeightKg ?? 70;
    const nextDisplay = kgToDisplay(current, massUnit) + direction * stepDisplay(massUnit);
    const nextKg = displayToKg(nextDisplay, massUnit);
    const clamped = Math.min(WEIGHT_MAX_KG, Math.max(WEIGHT_MIN_KG, nextKg));
    setWeightKg(roundWeightKg(clamped));
  };

  const title =
    mode === 'stale' && savedWeightKg != null
      ? `Still ${formatWeight(savedWeightKg, massUnit)} ${unit.toLowerCase()}?`
      : 'One thing first: your weight.';
  const body =
    mode === 'stale'
      ? `Last updated in ${updated?.month ?? 'a while'}. Your weight feeds your calorie estimate, so we check in now and then.`
      : 'We need it to estimate the calories you burn. Takes ten seconds.';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.kickerRow}>
            <Text style={styles.kicker}>
              {mode === 'stale' ? 'QUICK CHECK · EVERY FEW MONTHS' : 'BEFORE KICK-OFF · ASKED ONCE'}
            </Text>
            <TouchableOpacity onPress={onDismiss} disabled={busy} accessibilityRole="button">
              <Text style={styles.dismiss}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          <Text style={styles.label}>WEIGHT</Text>
          {mode === 'stale' && updated ? (
            <Text style={styles.meta}>LAST SET {updated.day}</Text>
          ) : null}
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.step} onPress={() => nudge(-1)} disabled={busy}>
              <Text style={styles.stepLabel}>−</Text>
            </TouchableOpacity>
            <View style={styles.valueBlock}>
              <Text style={styles.value}>{shown}</Text>
              <Text style={styles.unit}>{unit}</Text>
            </View>
            <TouchableOpacity style={styles.step} onPress={() => nudge(1)} disabled={busy}>
              <Text style={styles.stepLabel}>+</Text>
            </TouchableOpacity>
          </View>

          {mode === 'missing' && sexMissing ? (
            <View style={styles.sexBlock}>
              <Text style={styles.label}>SEX</Text>
              <View style={styles.chips}>
                {SEX_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={sexLabel(option)}
                    selected={sex === option}
                    onPress={() => setSex(sex === option ? null : option)}
                    variant="position"
                  />
                ))}
              </View>
              <Text style={styles.hint}>
                Biological sex — some energy formulas use it. Prefer not to say works just as well.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={
              unchanged && savedWeightKg != null
                ? `YES, STILL ${formatWeight(savedWeightKg, massUnit)} ${unit}`
                : 'SAVE'
            }
            onPress={() => {
              if (weightKg == null) return;
              onSave({ weightKg: roundWeightKg(weightKg), sex });
            }}
            disabled={!canSave}
            loading={busy}
          />
          <Text style={styles.private}>PRIVATE · NEVER ON YOUR PUBLIC PROFILE</Text>
          {mode === 'stale' ? <Text style={styles.hint}>CHANGED? USE − / + AND SAVE</Text> : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.medium,
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    paddingBottom: spacing[8],
    gap: 10,
  },
  kickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.brand.primary,
  },
  dismiss: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 16,
    color: colors.text.secondary,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 28,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
    letterSpacing: -0.6,
  },
  body: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  label: {
    marginTop: 8,
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.secondary,
  },
  meta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.tertiary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  stepLabel: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 28,
    color: colors.text.primary,
  },
  valueBlock: {
    alignItems: 'center',
  },
  value: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 40,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
  },
  unit: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.text.secondary,
  },
  sexBlock: {
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hint: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.tertiary,
  },
  error: {
    color: colors.accent.danger,
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
  },
  private: {
    textAlign: 'center',
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.tertiary,
  },
});
