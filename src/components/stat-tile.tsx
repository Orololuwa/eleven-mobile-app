import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { typography, type Colors, useThemedStyles } from '@/theme';

export type StatTileTrend = 'up' | 'down' | 'level' | null;

type StatTileProps = {
  label: string;
  value: string | number;
  subtitle?: string;
  isRecord?: boolean;
  isHero?: boolean;
  /** Direction against a baseline; shape carries the meaning, not just colour. */
  trend?: StatTileTrend;
  /** Spoken as one element when set. */
  accessibilityLabel?: string;
  style?: ViewStyle;
};

const TREND_GLYPH = { up: '▲', down: '▼', level: '=' } as const;

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  subtitle,
  isRecord = false,
  isHero = false,
  trend = null,
  accessibilityLabel,
  style,
}) => {
  const styles = useThemedStyles(createStyles);
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
    <View
      style={[styles.container, style]}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, isRecord && styles.valueRecord]}>{value}</Text>
        {trend && (
          <Text style={[styles.trend, trend === 'up' && styles.trendUp]}>{TREND_GLYPH[trend]}</Text>
        )}
      </View>
      {subtitle && (
        <Text style={[styles.subtitle, isRecord && styles.subtitleRecord]}>
          {subtitle.toUpperCase()}
        </Text>
      )}
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    value: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 32,
      letterSpacing: -0.02 * 32,
      color: colors.text.primary,
    },
    valueRecord: {
      color: colors.brand.ink,
    },
    trend: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 12,
      color: colors.text.secondary,
    },
    trendUp: {
      color: colors.brand.ink,
    },
    subtitle: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 9,
      letterSpacing: 0.14 * 9,
      color: colors.text.secondary,
    },
    subtitleRecord: {
      color: colors.brand.ink,
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
