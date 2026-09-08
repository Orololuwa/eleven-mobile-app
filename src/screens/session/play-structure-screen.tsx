import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Field, SegmentedControl } from '@/components';
import { colors, typography, spacing } from '@/theme';
import type { ActivityKind, PlayStructure, SessionType } from '@/features/sessions/types';
import {
  ACTIVITY_KINDS,
  EXTRA_TIME_PRESETS,
  HALVES_PRESETS,
  SETS_PRESETS,
  parseSegmentMinutesInput,
  validateExtraTime,
  validatePlannedSegmentLength,
  validateTrainingActivityOptions,
} from '@/features/sessions/validation';

type WizardStep = 'structure' | 'extra-time';

type PlayStructureScreenProps = {
  sessionType: SessionType;
  playStructure: PlayStructure;
  plannedSegmentLengthMinutes: number | null;
  extraTimeEnabled: boolean | null;
  plannedExtraTimeSegmentLengthMinutes: number | null;
  trainingActivityOptions: ActivityKind[];
  error?: string | null;
  onSelectStructure: (structure: PlayStructure) => void;
  onChangeMinutes: (minutes: number | null) => void;
  onSelectExtraTimeEnabled: (enabled: boolean) => void;
  onChangeExtraTimeMinutes: (minutes: number | null) => void;
  onToggleTrainingActivity: (kind: ActivityKind) => void;
  onContinue: () => void;
  onBack: () => void;
};

const FUTSAL_OPTIONS: PlayStructure[] = ['halves', 'sets'];
const FUTSAL_LABELS = ['Halves', 'Sets'];

const activityLabel = (kind: ActivityKind) => {
  if (kind === 'run') return 'Run';
  if (kind === 'drill') return 'Drill';
  return 'Set';
};

export const PlayStructureScreen: React.FC<PlayStructureScreenProps> = ({
  sessionType,
  playStructure,
  plannedSegmentLengthMinutes,
  extraTimeEnabled,
  plannedExtraTimeSegmentLengthMinutes,
  trainingActivityOptions,
  error = null,
  onSelectStructure,
  onChangeMinutes,
  onSelectExtraTimeEnabled,
  onChangeExtraTimeMinutes,
  onToggleTrainingActivity,
  onContinue,
  onBack,
}) => {
  const [step, setStep] = useState<WizardStep>('structure');
  const [minutesInput, setMinutesInput] = useState(
    plannedSegmentLengthMinutes != null ? String(plannedSegmentLengthMinutes) : '',
  );
  const [extraMinutesInput, setExtraMinutesInput] = useState(
    plannedExtraTimeSegmentLengthMinutes != null
      ? String(plannedExtraTimeSegmentLengthMinutes)
      : '',
  );
  const [minutesFocused, setMinutesFocused] = useState(false);
  const [extraMinutesFocused, setExtraMinutesFocused] = useState(false);

  const isTraining = sessionType === 'training';
  const isMatch = sessionType === 'match';
  const isFutsal = sessionType === 'futsal';
  const showStructurePicker = isFutsal;
  const needsExtraTimeStep = playStructure === 'halves';

  const presets = playStructure === 'halves' ? HALVES_PRESETS : SETS_PRESETS;
  const selectedFutsalIndex = FUTSAL_OPTIONS.indexOf(playStructure);

  const lengthError = useMemo(() => {
    if (isTraining) return undefined;
    const parsed = parseSegmentMinutesInput(minutesInput);
    if (minutesInput.trim() && Number.isNaN(parsed)) return 'Enter a whole number of minutes';
    return validatePlannedSegmentLength({
      playStructure,
      minutes: parsed,
    });
  }, [isTraining, minutesInput, playStructure]);

  const trainingError = useMemo(
    () =>
      validateTrainingActivityOptions({
        sessionType,
        options: trainingActivityOptions,
      }),
    [sessionType, trainingActivityOptions],
  );

  const extraTimeError = useMemo(() => {
    if (!needsExtraTimeStep || step !== 'extra-time') return undefined;
    const parsed = parseSegmentMinutesInput(extraMinutesInput);
    if (extraMinutesInput.trim() && Number.isNaN(parsed)) {
      return 'Enter a whole number of minutes';
    }
    return validateExtraTime({
      playStructure,
      enabled: extraTimeEnabled,
      minutes: extraTimeEnabled === true ? parsed : null,
    });
  }, [needsExtraTimeStep, step, extraMinutesInput, playStructure, extraTimeEnabled]);

  const canContinueStructure = isTraining
    ? trainingError == null && trainingActivityOptions.length > 0
    : lengthError == null && (playStructure === 'sets' || plannedSegmentLengthMinutes != null);

  const canContinueExtraTime =
    extraTimeError == null &&
    extraTimeEnabled != null &&
    (extraTimeEnabled === false || plannedExtraTimeSegmentLengthMinutes != null);

  const applyMinutes = (value: string) => {
    setMinutesInput(value);
    const parsed = parseSegmentMinutesInput(value);
    if (parsed == null) {
      onChangeMinutes(null);
      return;
    }
    if (Number.isNaN(parsed) || !Number.isInteger(parsed)) return;
    onChangeMinutes(parsed);
  };

  const applyExtraMinutes = (value: string) => {
    setExtraMinutesInput(value);
    const parsed = parseSegmentMinutesInput(value);
    if (parsed == null) {
      onChangeExtraTimeMinutes(null);
      return;
    }
    if (Number.isNaN(parsed) || !Number.isInteger(parsed)) return;
    onChangeExtraTimeMinutes(parsed);
  };

  const handleContinue = () => {
    if (step === 'structure' && needsExtraTimeStep && !isTraining) {
      setStep('extra-time');
      return;
    }
    onContinue();
  };

  const handleBack = () => {
    if (step === 'extra-time') {
      setStep('structure');
      return;
    }
    onBack();
  };

  const headerTitle =
    step === 'extra-time'
      ? 'Can this go to\nextra time?'
      : isTraining
        ? 'What are you\ntraining today?'
        : isMatch
          ? 'How long is\neach half?'
          : 'How is the game\nstructured?';

  const stepLabel =
    step === 'extra-time' ? 'EXTRA TIME' : isTraining ? 'TRAINING ACTIVITIES' : 'PLAY STRUCTURE';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backRow} onPress={handleBack}>
          <Text style={styles.backText}>◂ BACK</Text>
        </TouchableOpacity>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.stepLabel}>{stepLabel}</Text>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
          </View>

          {step === 'structure' && isTraining ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SELECT ONE OR MORE</Text>
              <View style={styles.presets}>
                {ACTIVITY_KINDS.map((kind) => (
                  <Chip
                    key={kind}
                    label={activityLabel(kind)}
                    selected={trainingActivityOptions.includes(kind)}
                    onPress={() => onToggleTrainingActivity(kind)}
                  />
                ))}
              </View>
              <Text style={styles.hintInline}>
                You&apos;ll start and stop each run, drill, or set live. Choose Set if you want a
                pitch heatmap.
              </Text>
              {trainingError ? <Text style={styles.inlineError}>{trainingError}</Text> : null}
            </View>
          ) : null}

          {step === 'structure' && !isTraining ? (
            <>
              {showStructurePicker ? (
                <View style={styles.section}>
                  <SegmentedControl
                    options={FUTSAL_LABELS}
                    selectedIndex={Math.max(0, selectedFutsalIndex)}
                    onSelect={(index) => {
                      const next = FUTSAL_OPTIONS[index];
                      if (next) onSelectStructure(next);
                    }}
                  />
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  {playStructure === 'halves'
                    ? 'PLANNED SEGMENT LENGTH'
                    : 'PLANNED SEGMENT LENGTH — OPTIONAL'}
                </Text>
                <View style={styles.presets}>
                  {presets.map((preset) => (
                    <Chip
                      key={preset}
                      label={`${preset} min`}
                      selected={plannedSegmentLengthMinutes === preset}
                      onPress={() => {
                        setMinutesInput(String(preset));
                        onChangeMinutes(preset);
                      }}
                    />
                  ))}
                </View>
                <Field
                  label="Custom minutes"
                  value={minutesInput}
                  onChangeText={applyMinutes}
                  keyboardType="number-pad"
                  placeholder="e.g. 30"
                  focused={minutesFocused}
                  onFocus={() => setMinutesFocused(true)}
                  onBlur={() => setMinutesFocused(false)}
                  error={lengthError}
                  optional={playStructure === 'sets'}
                />
                <Text style={styles.hintInline}>
                  {playStructure === 'halves'
                    ? 'Drives the half-time nudge once the session is live.'
                    : 'Soft reminder only — sets still end when you say so.'}
                </Text>
              </View>
            </>
          ) : null}

          {step === 'extra-time' ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>EXTRA TIME</Text>
              <View style={styles.presets}>
                <Chip
                  label="Yes"
                  selected={extraTimeEnabled === true}
                  onPress={() => onSelectExtraTimeEnabled(true)}
                />
                <Chip
                  label="No"
                  selected={extraTimeEnabled === false}
                  onPress={() => {
                    setExtraMinutesInput('');
                    onSelectExtraTimeEnabled(false);
                  }}
                />
              </View>

              {extraTimeEnabled === true ? (
                <>
                  <Text style={styles.sectionLabel}>PLANNED EXTRA TIME LENGTH</Text>
                  <View style={styles.presets}>
                    {EXTRA_TIME_PRESETS.map((preset) => (
                      <Chip
                        key={preset}
                        label={`${preset} min`}
                        selected={plannedExtraTimeSegmentLengthMinutes === preset}
                        onPress={() => {
                          setExtraMinutesInput(String(preset));
                          onChangeExtraTimeMinutes(preset);
                        }}
                      />
                    ))}
                  </View>
                  <Field
                    label="Custom minutes"
                    value={extraMinutesInput}
                    onChangeText={applyExtraMinutes}
                    keyboardType="number-pad"
                    placeholder="e.g. 10"
                    focused={extraMinutesFocused}
                    onFocus={() => setExtraMinutesFocused(true)}
                    onBlur={() => setExtraMinutesFocused(false)}
                    error={extraTimeError}
                  />
                  <Text style={styles.hintInline}>
                    Used if you tap Add Extra Time after the second half. You won&apos;t be asked
                    again live.
                  </Text>
                </>
              ) : (
                <Text style={styles.hintInline}>
                  You can still end after two halves. Extra time is only offered live if you enable
                  it here.
                </Text>
              )}
              {extraTimeError ? <Text style={styles.inlineError}>{extraTimeError}</Text> : null}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            title="Continue"
            onPress={handleContinue}
            size="large"
            disabled={step === 'structure' ? !canContinueStructure : !canContinueExtraTime}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing[6],
  },
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
  section: {
    paddingHorizontal: spacing[6],
    gap: 14,
    marginBottom: spacing[6],
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hintInline: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
  inlineError: {
    fontSize: 14,
    color: colors.accent.danger,
  },
  error: {
    paddingHorizontal: spacing[6],
    marginTop: spacing[4],
    fontSize: 14,
    color: colors.accent.danger,
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[9],
  },
});
