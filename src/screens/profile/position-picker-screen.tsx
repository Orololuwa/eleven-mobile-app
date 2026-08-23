import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip } from '@/components';
import { colors, typography, spacing } from '@/theme';
import { POSITION_CODES, type PositionCode, type PositionIn } from '@/features/profile/types';
import { validatePositionSet } from '@/features/profile/validation';

type PositionPickerScreenProps = {
  initialPositions: PositionIn[];
  onCancel: () => void;
  onSave: (positions: PositionIn[]) => void;
};

export const PositionPickerScreen: React.FC<PositionPickerScreenProps> = ({
  initialPositions,
  onCancel,
  onSave,
}) => {
  const [selected, setSelected] = useState<PositionIn[]>(initialPositions);

  const selectedCodes = useMemo(() => new Set(selected.map((entry) => entry.position)), [selected]);
  const preferredCode = selected.find((entry) => entry.is_preferred)?.position ?? null;
  const validationError = validatePositionSet(selected);
  const canSave = !validationError;

  const togglePosition = (position: PositionCode) => {
    setSelected((current) => {
      if (current.some((entry) => entry.position === position)) {
        const next = current.filter((entry) => entry.position !== position);
        if (next.length === 1) return [{ ...next[0], is_preferred: true }];
        if (next.length > 0 && !next.some((entry) => entry.is_preferred)) {
          return next.map((entry, index) => ({ ...entry, is_preferred: index === 0 }));
        }
        return next;
      }
      if (current.length >= 5) return current;
      const isFirst = current.length === 0;
      return [...current, { position, is_preferred: isFirst }];
    });
  };

  const markPreferred = (position: PositionCode) => {
    setSelected((current) =>
      current.map((entry) => ({
        ...entry,
        is_preferred: entry.position === position,
      })),
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.headerAction}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Positions</Text>
        <TouchableOpacity disabled={!canSave} onPress={() => onSave(selected)}>
          <Text style={[styles.headerSave, !canSave && styles.headerSaveDisabled]}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Select up to 5 positions. Tap ★ on a selected position to mark it preferred.
        </Text>

        <View style={styles.chipGrid}>
          {POSITION_CODES.map((position) => {
            const isSelected = selectedCodes.has(position);
            const isPreferred = preferredCode === position;
            return (
              <View key={position} style={styles.chipWrap}>
                <Chip
                  label={position}
                  selected={isSelected}
                  onPress={() => togglePosition(position)}
                  variant="position"
                />
                {isSelected ? (
                  <TouchableOpacity
                    style={styles.starButton}
                    onPress={() => markPreferred(position)}
                  >
                    <Text style={[styles.star, isPreferred && styles.starActive]}>
                      {isPreferred ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>

        {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save Positions" onPress={() => onSave(selected)} disabled={!canSave} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  headerAction: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.text.secondary,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSave: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.brand.primary,
  },
  headerSaveDisabled: {
    color: colors.text.disabled,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
    gap: 18,
  },
  subtitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text.secondary,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chipWrap: {
    position: 'relative',
  },
  starButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: colors.text.secondary,
  },
  starActive: {
    color: colors.brand.primary,
  },
  error: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.accent.danger,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
  },
});
