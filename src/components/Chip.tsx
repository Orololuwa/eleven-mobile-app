import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography } from '@/theme';

type ChipVariant = 'filter' | 'milestone' | 'position';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: ChipVariant;
  completed?: boolean;
  style?: ViewStyle;
};

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  variant = 'filter',
  completed = false,
  style,
}) => {
  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderWidth: 1,
      paddingVertical: variant === 'position' ? 10 : 9,
      paddingHorizontal: 13,
    };

    if (variant === 'milestone') {
      if (completed) {
        return {
          ...baseStyle,
          borderColor: selected ? colors.brand.primary : colors.border.strong,
        };
      } else {
        return {
          ...baseStyle,
          borderColor: colors.border.subtle,
        };
      }
    }

    if (selected) {
      return {
        ...baseStyle,
        borderColor: colors.brand.primary,
        backgroundColor: colors.brand.primary,
      };
    }

    return {
      ...baseStyle,
      borderColor: colors.border.medium,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontFamily: typography.fontFamily.mono,
      fontSize: variant === 'milestone' ? 11 : 10,
      letterSpacing: 0.14 * (variant === 'milestone' ? 11 : 10),
    };

    if (variant === 'milestone') {
      if (completed) {
        return {
          ...baseStyle,
          color: selected ? colors.brand.primary : colors.text.primary,
        };
      } else {
        return {
          ...baseStyle,
          color: colors.text.disabled,
        };
      }
    }

    if (selected) {
      return {
        ...baseStyle,
        color: colors.background.secondary,
        fontWeight: typography.fontWeight.semibold,
      };
    }

    return {
      ...baseStyle,
      color: colors.text.secondary,
    };
  };

  const displayLabel = variant === 'milestone' ? (completed ? `✓ ${label}` : `○ ${label}`) : label;

  return (
    <TouchableOpacity
      style={[styles.container, getContainerStyle(), style]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Text style={getTextStyle()}>{displayLabel}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
});
