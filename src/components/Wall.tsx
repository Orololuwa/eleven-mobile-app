import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/theme';

type WallProps = {
  total: number;
  built: number;
  style?: ViewStyle;
};

export const Wall: React.FC<WallProps> = ({ total, built, style }) => {
  return (
    <View style={[styles.container, style]}>
      {Array.from({ length: total }).map((_, index) => {
        const isBrick = index < built;
        const relativePosition = index % 20;
        const opacity = isBrick ? 0.5 + 0.5 * (relativePosition / 20 + 0.4) : 1;

        return (
          <View
            key={index}
            style={[
              styles.brick,
              {
                backgroundColor: isBrick ? colors.brand.primary : colors.border.subtle,
                opacity: isBrick ? opacity : 1,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  brick: {
    width: 15,
    height: 9,
  },
});
