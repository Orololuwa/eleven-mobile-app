import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '../theme';

type StatusPillProps = {
  label: string;
  status?: 'live' | 'paused' | 'gps' | 'streak';
  style?: ViewStyle;
};

export const StatusPill: React.FC<StatusPillProps> = ({
  label,
  status = 'live',
  style,
}) => {
  const getIndicatorStyle = () => {
    switch (status) {
      case 'live':
        return {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.brand.primary,
        };
      case 'paused':
        return {
          width: 8,
          height: 8,
          backgroundColor: colors.accent.warning,
        };
      case 'gps':
      case 'streak':
        return null;
    }
  };

  const getTextColor = () => {
    switch (status) {
      case 'live':
        return colors.brand.primary;
      case 'paused':
        return colors.accent.warning;
      case 'gps':
        return colors.text.secondary;
      case 'streak':
        return colors.brand.primary;
    }
  };

  const indicatorStyle = getIndicatorStyle();

  return (
    <View style={[styles.container, style]}>
      {indicatorStyle && <View style={indicatorStyle} />}
      <Text style={[styles.text, { color: getTextColor() }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
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
