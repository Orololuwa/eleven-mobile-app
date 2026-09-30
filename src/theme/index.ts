// Eleven Design System - Theme Configuration
// Based on the Eleven Component Library

export { darkColors, lightColors } from './colors';
export type { Colors } from './colors';

export const typography = {
  // Font Families
  fontFamily: {
    primary: 'Archivo',
    mono: 'IBM Plex Mono',
  },

  // Font Sizes
  fontSize: {
    xs: 9,
    sm: 10,
    base: 11,
    md: 12,
    lg: 13,
    xl: 15,
    '2xl': 16,
    '3xl': 17,
    '4xl': 19,
    '5xl': 20,
    '6xl': 22,
    '7xl': 24,
    '8xl': 26,
    '9xl': 30,
    '10xl': 32,
    '11xl': 34,
    '12xl': 36,
    '13xl': 44,
    '14xl': 62,
    '15xl': 78,
    '16xl': 82,
    '17xl': 104,
    '18xl': 150,
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },

  // Letter Spacing
  letterSpacing: {
    tighter: -0.06,
    tight: -0.03,
    normal: 0,
    wide: 0.12,
    wider: 0.14,
    widest: 0.24,
  },
};

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  18: 72,
  20: 80,
};

export const borderRadius = {
  none: 0,
  sm: 5,
  full: 9999,
};

export const layout = {
  screenPadding: 24,
  gutter: 24,
  gridBase: 4,
};

export { ForceColorScheme, useColors, useResolvedColorScheme, useThemedStyles } from './use-colors';
export type { ColorSchemeName } from './use-colors';
