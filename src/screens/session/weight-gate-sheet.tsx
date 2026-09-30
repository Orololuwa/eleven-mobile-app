import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Chip } from '@/components';
import { spacing, typography, type Colors, useColors, useThemedStyles } from '@/theme';
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
import {
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
  roundWeightKg,
  validateWeightKg,
} from '@/features/profile/validation';

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

const sanitizeWeightDraft = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned
    .slice(dot + 1)
    .replace(/\./g, '')
    .slice(0, 1);
  return `${whole}.${fraction}`;
};

const parseWeightDraft = (draft: string) => {
  if (!draft || draft === '.') return null;
  const value = Number(draft);
  return Number.isFinite(value) ? value : null;
};

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
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const [weightKg, setWeightKg] = useState<number | null>(mode === 'stale' ? savedWeightKg : null);
  const [draft, setDraft] = useState(
    mode === 'stale' && savedWeightKg != null ? formatWeight(savedWeightKg, massUnit) : '',
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const updated = formatWeightUpdated(weightUpdatedAt);
  const unit = weightUnitLabel(massUnit);
  const unchanged =
    mode === 'stale' &&
    savedWeightKg != null &&
    weightKg != null &&
    roundWeightKg(weightKg) === roundWeightKg(savedWeightKg);
  const canSave = weightKg != null && inputError == null && !busy;

  const commitKg = (kg: number) => {
    const rounded = roundWeightKg(kg);
    setWeightKg(rounded);
    setDraft(formatWeight(rounded, massUnit));
    setInputError(null);
  };

  const onType = (value: string) => {
    const next = sanitizeWeightDraft(value);
    setDraft(next);
    const display = parseWeightDraft(next);
    if (display == null) {
      setWeightKg(null);
      setInputError(null);
      return;
    }
    const kg = displayToKg(display, massUnit);
    const message = validateWeightKg(kg);
    setInputError(message ?? null);
    setWeightKg(message ? null : kg);
  };

  const nudge = (direction: 1 | -1) => {
    const current = weightKg ?? savedWeightKg ?? 70;
    const nextDisplay = kgToDisplay(current, massUnit) + direction * stepDisplay(massUnit);
    const nextKg = displayToKg(nextDisplay, massUnit);
    const clamped = Math.min(WEIGHT_MAX_KG, Math.max(WEIGHT_MIN_KG, nextKg));
    commitKg(clamped);
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
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
              <TextInput
                style={styles.value}
                value={draft}
                onChangeText={onType}
                keyboardType="decimal-pad"
                placeholder="— —"
                placeholderTextColor={colors.text.quaternary}
                textAlign="center"
                editable={!busy}
                selectTextOnFocus
                accessibilityLabel="Weight"
              />
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

          {inputError ? <Text style={styles.error}>{inputError}</Text> : null}
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
          {mode === 'stale' ? (
            <Text style={styles.hint}>CHANGED? TYPE IT, OR USE − / + AND SAVE</Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      color: colors.brand.ink,
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
      flex: 1,
      alignItems: 'center',
    },
    value: {
      minWidth: 140,
      padding: 0,
      includeFontPadding: false,
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
