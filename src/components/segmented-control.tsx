import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/theme';

type SegmentedControlProps = {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedIndex,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.segment, index === selectedIndex && styles.segmentSelected]}
          onPress={() => onSelect(index)}
          activeOpacity={0.7}
        >
          <Text style={[styles.text, index === selectedIndex && styles.textSelected]}>
            {option.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.border.subtle,
    gap: 1,
  },
  segment: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.brand.primary,
  },
  text: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.14 * 12,
    color: colors.text.secondary,
  },
  textSelected: {
    color: colors.background.secondary,
    fontWeight: typography.fontWeight.semibold,
  },
});
