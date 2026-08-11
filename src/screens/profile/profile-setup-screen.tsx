import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, Chip, SegmentedControl, Button } from '@/components';
import { colors, typography, spacing } from '@/theme';
import { FOOT_OPTIONS, POSITIONS, type ProfileData } from '@/types/profile';

export type { ProfileData };

type ProfileSetupScreenProps = {
  onComplete: (data: ProfileData) => void;
  onSkip: () => void;
};

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({ onComplete, onSkip }) => {
  const [firstName, setFirstName] = useState('');
  const [selectedPosition, setSelectedPosition] = useState(2); // MID
  const [selectedFoot, setSelectedFoot] = useState(0); // LEFT
  const [progress] = useState(2); // Step 2 of 3

  const handleComplete = () => {
    onComplete({
      firstName,
      fullName: firstName.trim(),
      position: POSITIONS[selectedPosition],
      preferredFoot: FOOT_OPTIONS[selectedFoot],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.progressBar}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.progressSegment, index < progress && styles.progressSegmentFilled]}
              />
            ))}
          </View>
          <TouchableOpacity onPress={onSkip}>
            <Text style={styles.skipButton}>SKIP</Text>
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.subtitle}>PROJECT //</Text>
          <Text style={styles.title}>Who are we{'\n'}building?</Text>
        </View>

        {/* Form */}
        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <Field
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            focused={firstName.length > 0}
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>POSITION</Text>
            <View style={styles.chipRow}>
              {POSITIONS.map((position, index) => (
                <Chip
                  key={position}
                  label={position}
                  selected={selectedPosition === index}
                  onPress={() => setSelectedPosition(index)}
                  variant="position"
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PREFERRED FOOT</Text>
          <SegmentedControl
            options={[...FOOT_OPTIONS]}
            selectedIndex={selectedFoot}
            onSelect={setSelectedFoot}
          />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Height, weight and club can wait. You can play first.
          </Text>
          <Button title="Into the App" onPress={handleComplete} disabled={!firstName.trim()} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  progressBar: {
    flexDirection: 'row',
    gap: 5,
  },
  progressSegment: {
    width: 44,
    height: 3,
    backgroundColor: colors.border.default,
  },
  progressSegmentFilled: {
    backgroundColor: colors.brand.primary,
  },
  skipButton: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.text.secondary,
  },
  titleSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[9],
    gap: 12,
  },
  subtitle: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.34 * 11,
    color: colors.brand.primary,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 36,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 36,
    lineHeight: 36 * 1.02,
    color: colors.text.primary,
  },
  form: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
  },
  section: {
    marginTop: 26,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.18 * 9,
    color: colors.text.secondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[9],
    gap: 12,
  },
  footerText: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
});
