import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAppearanceStore } from '@/stores/appearance-store';
import { darkColors, lightColors } from './colors';
import type { Colors } from './colors';

export type ColorSchemeName = 'light' | 'dark';

const ForcedSchemeContext = createContext<ColorSchemeName | null>(null);

/** Pins a subtree to one palette regardless of the user's appearance choice. */
export const ForceColorScheme = ({
  scheme,
  children,
}: {
  scheme: ColorSchemeName;
  children: ReactNode;
}) => <ForcedSchemeContext.Provider value={scheme}>{children}</ForcedSchemeContext.Provider>;

/** The phone scheme resolved against the user's Appearance preference. */
export const useAppColorScheme = (): ColorSchemeName => {
  const preference = useAppearanceStore((s) => s.preference);
  const system = useColorScheme();
  if (preference !== 'system') return preference;
  return system === 'light' ? 'light' : 'dark';
};

export const useResolvedColorScheme = (): ColorSchemeName => {
  const forced = useContext(ForcedSchemeContext);
  const scheme = useAppColorScheme();
  return forced ?? scheme;
};

export const useColors = (): Colors =>
  useResolvedColorScheme() === 'light' ? lightColors : darkColors;

export const useThemedStyles = <T,>(createStyles: (colors: Colors) => T): T => {
  const colors = useColors();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
};
