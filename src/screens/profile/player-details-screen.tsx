import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, Chip, SegmentedControl, Button } from '@/components';
import { colors, typography, spacing } from '@/theme';
import { FOOT_OPTIONS, POSITIONS, type ProfileData, type UnitsPreference } from '@/types/profile';

type PlayerDetailsScreenProps = {
  user: ProfileData;
  units: UnitsPreference;
  onCancel: () => void;
  onSave: (data: ProfileData) => void;
};

export const PlayerDetailsScreen: React.FC<PlayerDetailsScreenProps> = ({
  user,
  units,
  onCancel,
  onSave,
}) => {
  const [fullName, setFullName] = useState(user.fullName || user.firstName || '');
  const [selectedPosition, setSelectedPosition] = useState(
    Math.max(
      0,
      POSITIONS.indexOf((user.position as (typeof POSITIONS)[number]) || 'MID')
    )
  );
  const [selectedFoot, setSelectedFoot] = useState(
    Math.max(
      0,
      FOOT_OPTIONS.indexOf((user.preferredFoot as (typeof FOOT_OPTIONS)[number]) || 'LEFT')
    )
  );
  const [height, setHeight] = useState(user.heightCm ? String(user.heightCm) : '');
  const [weight, setWeight] = useState(user.weightKg ? String(user.weightKg) : '');
  const [club, setClub] = useState(user.club || '');

  const heightUnit = units.distance === 'mi' ? 'IN' : 'CM';
  const weightUnit = units.mass.toUpperCase();

  const handleSave = () => {
    const trimmed = fullName.trim();
    onSave({
      ...user,
      fullName: trimmed,
      firstName: trimmed.split(/\s+/)[0] || user.firstName,
      position: POSITIONS[selectedPosition],
      preferredFoot: FOOT_OPTIONS[selectedFoot],
      heightCm: height ? Number(height) : undefined,
      weightKg: weight ? Number(weight) : undefined,
      club: club.trim() || undefined,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.headerAction}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerSave}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoRow}>
          <View style={styles.photoCircle}>
            <Text style={styles.photoLabel}>PHOTO</Text>
          </View>
          <View style={styles.photoCopy}>
            <TouchableOpacity>
              <Text style={styles.uploadText}>UPLOAD PHOTO</Text>
            </TouchableOpacity>
            <Text style={styles.uploadHint}>Used on your match cards.</Text>
          </View>
        </View>

        <Field
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          focused={fullName.length > 0}
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

        <View style={styles.metricsRow}>
          <View style={styles.metricField}>
            <Text style={styles.sectionLabel}>HEIGHT</Text>
            <View style={[styles.metricUnderline, height.length > 0 && styles.metricUnderlineFocused]}>
              <TextInput
                style={styles.metricValue}
                value={height}
                onChangeText={setHeight}
                keyboardType="number-pad"
                placeholder="178"
                placeholderTextColor={colors.text.quaternary}
              />
              <Text style={styles.metricUnit}>{heightUnit}</Text>
            </View>
          </View>
          <View style={styles.metricField}>
            <Text style={styles.sectionLabel}>WEIGHT</Text>
            <View style={[styles.metricUnderline, weight.length > 0 && styles.metricUnderlineFocused]}>
              <TextInput
                style={styles.metricValue}
                value={weight}
                onChangeText={setWeight}
                keyboardType="number-pad"
                placeholder="72"
                placeholderTextColor={colors.text.quaternary}
              />
              <Text style={styles.metricUnit}>{weightUnit}</Text>
            </View>
          </View>
        </View>

        <Field
          label="Current Club"
          optional
          value={club}
          onChangeText={setClub}
          placeholder="Add a club"
          focused={club.length > 0}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save Profile" onPress={handleSave} disabled={!fullName.trim()} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  headerAction: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.text.secondary,
  },
  headerTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSave: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.brand.primary,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[8],
    gap: 26,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  photoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
  },
  photoCopy: {
    gap: 8,
  },
  uploadText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.14 * 12,
    color: colors.brand.primary,
  },
  uploadHint: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    color: colors.text.secondary,
  },
  section: {
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
  metricsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  metricField: {
    flex: 1,
    gap: 10,
  },
  metricUnderline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
    paddingBottom: 10,
    gap: 8,
  },
  metricUnderlineFocused: {
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.primary,
  },
  metricValue: {
    flex: 1,
    fontFamily: typography.fontFamily.primary,
    fontSize: 18,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    padding: 0,
  },
  metricUnit: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    color: colors.text.secondary,
    paddingBottom: 2,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
  },
});
