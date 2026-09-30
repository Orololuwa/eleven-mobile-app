import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { typography, spacing, type Colors, type ColorSchemeName, useThemedStyles } from '@/theme';
import type { AppearancePreference } from '@/stores/appearance-store';

type AppearanceScreenProps = {
  preference: AppearancePreference;
  activeScheme: ColorSchemeName;
  onBack: () => void;
  onChange: (preference: AppearancePreference) => void;
};

const OPTIONS: { id: AppearancePreference; label: string }[] = [
  { id: 'system', label: 'Match phone' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const optionDetail = ({
  id,
  activeScheme,
}: {
  id: AppearancePreference;
  activeScheme: ColorSchemeName;
}) =>
  id === 'system'
    ? `FOLLOWS SYSTEM · ${activeScheme.toUpperCase()} NOW`
    : `ALWAYS ${id.toUpperCase()}`;

export const AppearanceScreen: React.FC<AppearanceScreenProps> = ({
  preference,
  activeScheme,
  onBack,
  onChange,
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Text style={styles.backText}>◂ PROFILE</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Appearance</Text>
        <Text style={styles.description}>
          Light is easier to read in daylight. Dark is easier on the eyes under floodlights.
        </Text>

        <Text style={styles.sectionLabel}>THEME</Text>
        <View style={styles.list}>
          {OPTIONS.map((option) => {
            const selected = preference === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => onChange(option.id)}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowLabel}>{option.label}</Text>
                  <Text style={styles.rowDetail}>
                    {optionDetail({ id: option.id, activeScheme })}
                  </Text>
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

        <Text style={styles.footer}>SIGN-IN AND SHARE CARDS STAY DARK EITHER WAY.</Text>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
      borderColor: colors.brand.ink,
    },
    rowCopy: {
      gap: 6,
    },
    rowLabel: {
      fontFamily: typography.fontFamily.primary,
      fontSize: 16,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    rowDetail: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 10,
      letterSpacing: 0.14 * 10,
      color: colors.text.secondary,
    },
    check: {
      color: colors.brand.ink,
      fontSize: 16,
    },
    unchecked: {
      color: colors.text.tertiary,
      fontSize: 16,
    },
    footer: {
      marginTop: spacing[6],
      fontFamily: typography.fontFamily.mono,
      fontSize: 10,
      lineHeight: 16,
      letterSpacing: 0.12 * 10,
      color: colors.text.disabled,
    },
  });
