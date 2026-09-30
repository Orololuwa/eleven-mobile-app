import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { typography, type Colors, useThemedStyles, useColors } from '@/theme';

type StatusPillProps = {
  label: string;
  status?: 'live' | 'paused' | 'holding' | 'gps' | 'streak';
  style?: ViewStyle;
};

export const StatusPill: React.FC<StatusPillProps> = ({ label, status = 'live', style }) => {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const getIndicatorStyle = () => {
    switch (status) {
      case 'live':
        return {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.brand.ink,
        };
      case 'paused':
        return {
          width: 8,
          height: 8,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.text.primary,
          backgroundColor: 'transparent',
        };
      case 'holding':
        return {
          width: 8,
          height: 8,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: colors.text.secondary,
          backgroundColor: 'transparent',
        };
      case 'gps':
      case 'streak':
        return null;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'live':
        return colors.brand.ink;
      case 'paused':
        return colors.text.primary;
      case 'holding':
        return colors.text.secondary;
      case 'gps':
        return colors.text.secondary;
      case 'streak':
        return colors.brand.ink;
    }
  };

  const indicatorStyle = getIndicatorStyle();

  return (
    <View style={[styles.container, style]}>
      {indicatorStyle && <View style={indicatorStyle} />}
      <Text style={[styles.text, { color: getTextColor() }]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    text: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 11,
      letterSpacing: 0.2 * 11,
    },
  });
