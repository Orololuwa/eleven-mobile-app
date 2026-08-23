import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, SegmentedControl, Button } from '@/components';
import { colors, typography, spacing } from '@/theme';
import type { PositionIn, PreferredFoot } from '@/features/profile/types';
import { PREFERRED_FOOT_OPTIONS } from '@/features/profile/types';
import { preferredPosition } from '@/features/profile/display';
import { validateDisplayName, validatePositionSet } from '@/features/profile/validation';

type ProfileSetupScreenProps = {
  displayName: string;
  preferredFootIndex: number;
  initialPositions: PositionIn[];
  busy?: boolean;
  error?: string | null;
  onDisplayNameChange: (displayName: string) => void;
  onPreferredFootIndexChange: (index: number) => void;
  onComplete: (data: {
    display_name: string;
    preferred_foot: PreferredFoot;
    positions: PositionIn[];
  }) => void;
  onOpenPositionPicker: () => void;
};

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  displayName,
  preferredFootIndex,
  initialPositions,
  busy = false,
  error = null,
  onDisplayNameChange,
  onPreferredFootIndexChange,
  onComplete,
  onOpenPositionPicker,
}) => {
  const progress = 2;
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [positionsTouched, setPositionsTouched] = useState(false);

  const displayNameError = validateDisplayName(displayName);
  const positionError = validatePositionSet(initialPositions);
  const canComplete = !busy && !displayNameError && !positionError;

  const handleComplete = () => {
    if (!canComplete) return;
    onComplete({
      display_name: displayName.trim(),
      preferred_foot: PREFERRED_FOOT_OPTIONS[preferredFootIndex],
      positions: initialPositions,
    });
  };

  const positionSummary = preferredPosition(
    initialPositions.map((entry) => ({
      position: entry.position,
      is_preferred: Boolean(entry.is_preferred),
    })),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.progressBar}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.progressSegment, index < progress && styles.progressSegmentFilled]}
              />
            ))}
          </View>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.subtitle}>PROJECT //</Text>
          <Text style={styles.title}>Who are we{'\n'}building?</Text>
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <Field
            label="Display Name"
            value={displayName}
            onChangeText={onDisplayNameChange}
            onBlur={() => setDisplayNameTouched(true)}
            placeholder="Enter your display name"
            focused={displayName.length > 0}
            error={displayNameTouched ? displayNameError : undefined}
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>POSITIONS</Text>
            <TouchableOpacity
              style={styles.positionRow}
              onPress={() => {
                setPositionsTouched(true);
                onOpenPositionPicker();
              }}
            >
              <Text style={styles.positionValue}>
                {initialPositions.length > 0
                  ? `${initialPositions.length} selected · ${positionSummary ?? '—'} preferred`
                  : 'Choose up to 5 positions'}
              </Text>
              <Text style={styles.positionChevron}>▸</Text>
            </TouchableOpacity>
            {positionsTouched && positionError ? (
              <Text style={styles.inlineError}>{positionError}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PREFERRED FOOT</Text>
            <SegmentedControl
              options={PREFERRED_FOOT_OPTIONS.map((foot) => foot.toUpperCase())}
              selectedIndex={preferredFootIndex}
              onSelect={onPreferredFootIndexChange}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Height, bio and avatar can wait. You can play first.
          </Text>
          <Button title="Into the App" onPress={handleComplete} disabled={!canComplete} />
        </View>
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
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  progressBar: {
    flexDirection: 'row',
    gap: 5,
  },
  progressSegment: {
    width: 44,
    height: 3,
    backgroundColor: colors.border.default,
  },
  progressSegmentFilled: {
    backgroundColor: colors.brand.primary,
  },
  titleSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[9],
    gap: 12,
  },
  subtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.34 * 11,
    color: colors.brand.primary,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 36,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 36,
    lineHeight: 36 * 1.02,
    color: colors.text.primary,
  },
  form: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
  },
  section: {
    marginTop: 26,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.18 * 9,
    color: colors.text.secondary,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
    paddingBottom: 12,
  },
  positionValue: {
    flex: 1,
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    color: colors.text.primary,
  },
  positionChevron: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    color: colors.brand.primary,
  },
  inlineError: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.accent.danger,
  },
  error: {
    marginTop: 18,
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.accent.danger,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[9],
    gap: 12,
  },
  footerText: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
});
