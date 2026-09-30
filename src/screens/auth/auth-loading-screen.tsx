import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { type Colors, useThemedStyles, useColors } from '@/theme';

export const AuthLoadingScreen = () => {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.brand.ink} />
    </View>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
