import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';
import type { DistanceUnit, MassUnit, UnitsPreference } from '@/types/profile';

type UnitsScreenProps = {
  units: UnitsPreference;
  onBack: () => void;
  onChange: (units: UnitsPreference) => void;
};

const DISTANCE_OPTIONS: { id: DistanceUnit; label: string; detail: string }[] = [
  { id: 'km', label: 'Kilometres', detail: 'KM · METRIC' },
  { id: 'mi', label: 'Miles', detail: 'MI · IMPERIAL' },
];

const MASS_OPTIONS: { id: MassUnit; label: string; detail: string }[] = [
  { id: 'kg', label: 'Kilograms', detail: 'KG' },
  { id: 'lb', label: 'Pounds', detail: 'LB' },
];

export const UnitsScreen: React.FC<UnitsScreenProps> = ({ units, onBack, onChange }) => {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Text style={styles.backText}>◂ PROFILE</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Units</Text>
        <Text style={styles.description}>
          Numbers on the wall, history and match cards follow these.
        </Text>

        <Text style={styles.sectionLabel}>DISTANCE</Text>
        <View style={styles.list}>
          {DISTANCE_OPTIONS.map((option) => {
            const selected = units.distance === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => onChange({ ...units, distance: option.id })}
              >
                <View>
                  <Text style={styles.rowLabel}>{option.label}</Text>
                  <Text style={styles.rowDetail}>{option.detail}</Text>
                </View>
                {selected ? (
                  <Text style={styles.check}>●</Text>
                ) : (
                  <Text style={styles.unchecked}>○</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>MASS</Text>
        <View style={styles.list}>
          {MASS_OPTIONS.map((option) => {
            const selected = units.mass === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => onChange({ ...units, mass: option.id })}
              >
                <View>
                  <Text style={styles.rowLabel}>{option.label}</Text>
                  <Text style={styles.rowDetail}>{option.detail}</Text>
                </View>
                {selected ? (
                  <Text style={styles.check}>●</Text>
                ) : (
                  <Text style={styles.unchecked}>○</Text>
                )}
              </TouchableOpacity>
            );
          })}
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
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 36,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 36,
    color: colors.text.primary,
    marginBottom: 14,
  },
  description: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    lineHeight: 16 * 1.5,
    color: colors.text.secondary,
    marginBottom: spacing[8],
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
    marginBottom: 12,
    marginTop: spacing[2],
  },
  list: {
    gap: 10,
    marginBottom: spacing[6],
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowSelected: {
    borderColor: colors.brand.primary,
  },
  rowLabel: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  rowDetail: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    color: colors.text.secondary,
  },
  check: {
    color: colors.brand.primary,
    fontSize: 14,
  },
  unchecked: {
    color: colors.text.disabled,
    fontSize: 14,
  },
});
