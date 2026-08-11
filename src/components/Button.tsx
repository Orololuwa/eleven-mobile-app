import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { colors, typography } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: 'default' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  size = 'default',
  style,
  textStyle,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      height: size === 'large' ? 64 : 56,
      justifyContent: 'center',
      alignItems: 'center',
    };

    if (disabled) {
      return {
        ...baseStyle,
        backgroundColor: colors.background.elevated,
      };
    }

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: colors.brand.primary,
        };
      case 'secondary':
        return {
          ...baseStyle,
          borderWidth: 1,
          borderColor: colors.border.strong,
        };
      case 'ghost':
        return baseStyle;
      case 'danger':
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: colors.accent.danger,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontFamily: typography.fontFamily.mono,
      fontSize: variant === 'danger' ? 14 : 13,
      letterSpacing: 0.2 * (variant === 'danger' ? 14 : 13),
      fontWeight: typography.fontWeight.semibold,
    };

    if (disabled) {
      return {
        ...baseStyle,
        color: colors.text.tertiary,
      };
    }

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          color: colors.background.secondary,
        };
      case 'secondary':
      case 'ghost':
        return {
          ...baseStyle,
          color: colors.text.primary,
        };
      case 'danger':
        return {
          ...baseStyle,
          color: colors.accent.danger,
        };
      default:
        return baseStyle;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle(), fullWidth && styles.fullWidth, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.background.secondary : colors.text.primary}
        />
      ) : (
        <Text style={[getTextStyle(), textStyle]}>{title.toUpperCase()}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
});
