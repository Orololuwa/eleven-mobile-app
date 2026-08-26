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
import type { PlayStructure } from '@/features/sessions/types';
import {
  HALVES_PRESETS,
  SETS_PRESETS,
  parseSegmentMinutesInput,
  validatePlannedSegmentLength,
} from '@/features/sessions/validation';

const STRUCTURE_OPTIONS: PlayStructure[] = ['halves', 'sets', 'open'];
const STRUCTURE_LABELS = ['Halves', 'Sets', 'Open'];

type PlayStructureScreenProps = {
  playStructure: PlayStructure;
  plannedSegmentLengthMinutes: number | null;
  error?: string | null;
  onSelectStructure: (structure: PlayStructure) => void;
  onChangeMinutes: (minutes: number | null) => void;
  onContinue: () => void;
  onBack: () => void;
};

export const PlayStructureScreen: React.FC<PlayStructureScreenProps> = ({
  playStructure,
  plannedSegmentLengthMinutes,
  error = null,
  onSelectStructure,
  onChangeMinutes,
  onContinue,
  onBack,
}) => {
  const [minutesInput, setMinutesInput] = useState(
    plannedSegmentLengthMinutes != null ? String(plannedSegmentLengthMinutes) : '',
  );
  const [minutesFocused, setMinutesFocused] = useState(false);

  const presets = playStructure === 'halves' ? HALVES_PRESETS : SETS_PRESETS;
  const selectedIndex = STRUCTURE_OPTIONS.indexOf(playStructure);

  const lengthError = useMemo(() => {
    if (playStructure === 'open') return undefined;
    const parsed = parseSegmentMinutesInput(minutesInput);
    if (minutesInput.trim() && Number.isNaN(parsed)) return 'Enter a whole number of minutes';
    return validatePlannedSegmentLength({
      playStructure,
      minutes: parsed,
    });
  }, [minutesInput, playStructure]);

  const canContinue =
    playStructure === 'open' ||
    (lengthError == null && (playStructure === 'sets' || plannedSegmentLengthMinutes != null));

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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backRow} onPress={onBack}>
          <Text style={styles.backText}>◂ BACK</Text>
        </TouchableOpacity>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.stepLabel}>PLAY STRUCTURE</Text>
            <Text style={styles.headerTitle}>How is the game{'\n'}structured?</Text>
          </View>

          <View style={styles.section}>
            <SegmentedControl
              options={STRUCTURE_LABELS}
              selectedIndex={selectedIndex}
              onSelect={(index) => {
                const next = STRUCTURE_OPTIONS[index];
                if (next) onSelectStructure(next);
              }}
            />
          </View>

          {playStructure === 'open' ? (
            <Text style={styles.hint}>
              Solo drills and open training — no segment clock. You can still mark a pitch for a
              heatmap on the next step, or skip it.
            </Text>
          ) : (
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
              <Text style={styles.hint}>
                {playStructure === 'halves'
                  ? 'Drives the half-time nudge once the session is live.'
                  : 'Soft reminder only — sets still end when you say so.'}
              </Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.actions}>
          <Button title="Continue" onPress={onContinue} size="large" disabled={!canContinue} />
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
  hint: {
    paddingHorizontal: spacing[6],
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
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
