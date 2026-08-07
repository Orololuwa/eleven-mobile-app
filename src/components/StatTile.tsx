import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '../theme';

type StatTileProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  isRecord?: boolean;
  isHero?: boolean;
  style?: ViewStyle;
};

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subtitle,
  isRecord = false,
  isHero = false,
  style,
}) => {
  if (isHero) {
    return (
      <View style={[styles.heroContainer, style]}>
        <View style={styles.heroValueRow}>
          <Text style={styles.heroValue}>{value}</Text>
          {subtitle && <Text style={styles.heroUnit}>{subtitle}</Text>}
        </View>
        <Text style={styles.heroLabel}>{label.toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, isRecord && styles.valueRecord]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.subtitle, isRecord && styles.subtitleRecord]}>
          {subtitle.toUpperCase()}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    padding: 18,
    gap: 8,
  },
  label: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.secondary,
  },
  value: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 32,
    letterSpacing: -0.02 * 32,
    color: colors.text.primary,
  },
  valueRecord: {
    color: colors.brand.primary,
  },
  subtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.14 * 9,
    color: colors.text.secondary,
  },
  subtitleRecord: {
    color: colors.brand.primary,
  },
  heroContainer: {
    gap: 10,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  heroValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 78,
    lineHeight: 78 * 0.85,
    letterSpacing: -0.05 * 78,
    color: colors.text.primary,
  },
  heroUnit: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 18,
    color: colors.text.secondary,
    paddingBottom: 8,
  },
  heroLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.secondary,
  },
});
