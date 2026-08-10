import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography } from '@/theme';

type BrandMarkProps = {
  size?: 'small' | 'medium' | 'large';
  variant?: 'light' | 'dark' | 'outline';
  withText?: boolean;
  style?: ViewStyle;
};

const sizes = {
  small: { container: 28, bar: { width: 5, height: 13 }, gap: 3 },
  medium: { container: 34, bar: { width: 6, height: 16 }, gap: 4 },
  large: { container: 48, bar: { width: 8, height: 23 }, gap: 5 },
};

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 'medium',
  variant = 'light',
  withText = false,
  style,
}) => {
  const sizeConfig = sizes[size];

  const containerBg = variant === 'light'
    ? colors.brand.primary
    : variant === 'dark'
    ? colors.background.secondary
    : colors.text.primary;

  const barColor = variant === 'light'
    ? colors.background.secondary
    : colors.brand.primary;

  const containerStyle = variant === 'outline'
    ? { borderWidth: 1, borderColor: colors.border.strong }
    : {};

  return (
    <View style={[styles.wrapper, style]}>
      <View
        style={[
          styles.container,
          {
            width: sizeConfig.container,
            height: sizeConfig.container,
            backgroundColor: containerBg,
            gap: sizeConfig.gap,
          },
          containerStyle,
        ]}
      >
        <View
          style={[
            styles.bar,
            {
              width: sizeConfig.bar.width,
              height: sizeConfig.bar.height,
              backgroundColor: barColor,
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            {
              width: sizeConfig.bar.width,
              height: sizeConfig.bar.height,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      {withText && (
        <Text style={styles.text}>ELEVEN</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    transform: [{ skewX: '-9deg' }],
  },
  text: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 20,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.03 * 20,
    color: colors.text.primary,
  },
});
