import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import * as Location from 'expo-location';
import { AvatarPicker, Button, Chip, DateField, Field, SegmentedControl } from '@/components';
import { colors, typography, spacing } from '@/theme';
import type { UnitsPreference } from '@/types/profile';
import { preferredFootIndex, preferredPosition } from '@/features/profile/display';
import type {
  PositionIn,
  PreferredFoot,
  ProfileRead,
  ProfileUpdate,
  ProfileVisibility,
  SkillLevel,
} from '@/features/profile/types';
import {
  PREFERRED_FOOT_OPTIONS,
  PROFILE_VISIBILITY_OPTIONS,
  SKILL_LEVELS,
} from '@/features/profile/types';
import {
  BIO_MAX,
  validateBio,
  validateDateOfBirth,
  validateDisplayName,
  validateHeightCm,
} from '@/features/profile/validation';
import { parseIsoDate } from '@/features/profile/date';

type PlayerDetailsFormValues = {
  display_name: string;
  bio: string;
  date_of_birth: string;
  height_input: string;
  preferred_foot: PreferredFoot;
  skill_level: SkillLevel | null;
  visibility: ProfileVisibility;
};

type PlayerDetailsScreenProps = {
  profile: ProfileRead;
  draftPositions: PositionIn[];
  units: UnitsPreference;
  busy?: boolean;
  avatarBusy?: boolean;
  error?: string | null;
  fieldErrors?: Record<string, string>;
  onCancel: () => void;
  onSave: (update: ProfileUpdate, positions: PositionIn[]) => void;
  onOpenPositionPicker: () => void;
  onUploadAvatar: (uri: string) => void;
  onRemoveAvatar?: () => void;
};

const inchesToCm = (inches: number) => Math.round(inches * 2.54);
const cmToInches = (cm: number) => Math.round(cm / 2.54);

const heightInputFromProfile = ({
  height_cm,
  units,
}: {
  height_cm: number | null;
  units: UnitsPreference;
}) => {
  if (!height_cm) return '';
  return units.distance === 'mi' ? String(cmToInches(height_cm)) : String(height_cm);
};

const heightCmFromInput = ({ value, units }: { value: string; units: UnitsPreference }) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return units.distance === 'mi' ? inchesToCm(parsed) : Math.round(parsed);
};

export const PlayerDetailsScreen: React.FC<PlayerDetailsScreenProps> = ({
  profile,
  draftPositions,
  units,
  busy = false,
  avatarBusy = false,
  error = null,
  fieldErrors = {},
  onCancel,
  onSave,
  onOpenPositionPicker,
  onUploadAvatar,
  onRemoveAvatar,
}) => {
  const [locationBusy, setLocationBusy] = useState(false);
  const [location, setLocation] = useState(profile.location);

  const defaultValues = useMemo<PlayerDetailsFormValues>(
    () => ({
      display_name: profile.display_name,
      bio: profile.bio ?? '',
      date_of_birth: profile.date_of_birth ?? '',
      height_input: heightInputFromProfile({ height_cm: profile.height_cm, units }),
      preferred_foot: profile.preferred_foot ?? 'left',
      skill_level: profile.skill_level,
      visibility: profile.visibility,
    }),
    [
      profile.bio,
      profile.date_of_birth,
      profile.display_name,
      profile.height_cm,
      profile.preferred_foot,
      profile.skill_level,
      profile.visibility,
      units,
    ],
  );

  const { control, handleSubmit, reset, setError } = useForm<PlayerDetailsFormValues>({
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    const aliases: Record<string, keyof PlayerDetailsFormValues> = {
      display_name: 'display_name',
      bio: 'bio',
      date_of_birth: 'date_of_birth',
      preferred_foot: 'preferred_foot',
      skill_level: 'skill_level',
      visibility: 'visibility',
      height_cm: 'height_input',
    };

    Object.entries(fieldErrors).forEach(([field, message]) => {
      const name = aliases[field];
      if (name) setError(name, { type: 'server', message });
    });
  }, [fieldErrors, setError]);

  const locationLat = profile.location?.lat;
  const locationLng = profile.location?.lng;

  useEffect(() => {
    setLocation(
      locationLat == null || locationLng == null ? null : { lat: locationLat, lng: locationLng },
    );
  }, [locationLat, locationLng]);

  const positions = draftPositions.length > 0 ? draftPositions : profile.positions;
  const positionSummary = preferredPosition(
    positions.map((entry) => ({
      position: entry.position,
      is_preferred: Boolean(entry.is_preferred),
    })),
  );
  const heightUnit = units.distance === 'mi' ? 'IN' : 'CM';

  const submit = handleSubmit((values) => {
    const height_cm = heightCmFromInput({ value: values.height_input, units });
    const heightError = validateHeightCm(height_cm ?? undefined);
    if (heightError) return;

    onSave(
      {
        display_name: values.display_name.trim(),
        bio: values.bio.trim() || null,
        date_of_birth: parseIsoDate(values.date_of_birth) ? values.date_of_birth.trim() : null,
        height_cm,
        preferred_foot: values.preferred_foot,
        skill_level: values.skill_level,
        visibility: values.visibility,
        location,
      },
      positions.map((entry) => ({
        position: entry.position,
        is_preferred: Boolean(entry.is_preferred),
      })),
    );
  });

  const captureCurrentLocation = async () => {
    setLocationBusy(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      const current = await Location.getCurrentPositionAsync({});
      setLocation({
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      });
    } finally {
      setLocationBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity disabled={busy} onPress={onCancel}>
          <Text style={styles.headerAction}>CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Profile</Text>
        <TouchableOpacity disabled={busy} onPress={() => void submit()}>
          <Text style={styles.headerSave}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <AvatarPicker
          avatarUrl={profile.avatar_url}
          avatarUpdatedAt={profile.avatar_updated_at}
          editable
          busy={avatarBusy}
          onUpload={onUploadAvatar}
          onRemove={profile.avatar_url ? onRemoveAvatar : undefined}
        />

        <Controller
          control={control}
          name="display_name"
          rules={{
            validate: (value) => validateDisplayName(value),
          }}
          render={({ field: { value, onChange }, fieldState: { error: fieldError } }) => (
            <Field
              label="Display Name"
              value={value}
              onChangeText={onChange}
              focused={value.length > 0}
              error={fieldError?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="bio"
          rules={{
            validate: (value) => validateBio(value),
          }}
          render={({ field: { value, onChange }, fieldState: { error: fieldError } }) => (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>BIO</Text>
              <TextInput
                style={styles.bioInput}
                value={value}
                onChangeText={onChange}
                multiline
                maxLength={BIO_MAX}
                placeholder="Tell players about yourself"
                placeholderTextColor={colors.text.quaternary}
              />
              <Text style={styles.counter}>
                {value.length}/{BIO_MAX}
              </Text>
              {fieldError?.message ? (
                <Text style={styles.inlineError}>{fieldError.message}</Text>
              ) : null}
            </View>
          )}
        />

        <Controller
          control={control}
          name="date_of_birth"
          rules={{
            validate: (value) => validateDateOfBirth(value),
          }}
          render={({ field: { value, onChange }, fieldState: { error: fieldError } }) => (
            <DateField
              label="Date of Birth"
              optional
              value={value}
              onChange={onChange}
              error={fieldError?.message}
            />
          )}
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>POSITIONS</Text>
          <TouchableOpacity style={styles.positionRow} onPress={onOpenPositionPicker}>
            <Text style={styles.positionValue}>
              {positions.length > 0
                ? `${positions.length} selected · ${positionSummary ?? '—'} preferred`
                : 'Choose up to 5 positions'}
            </Text>
            <Text style={styles.positionChevron}>▸</Text>
          </TouchableOpacity>
        </View>

        <Controller
          control={control}
          name="preferred_foot"
          render={({ field: { value, onChange } }) => (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PREFERRED FOOT</Text>
              <SegmentedControl
                options={PREFERRED_FOOT_OPTIONS.map((foot) => foot.toUpperCase())}
                selectedIndex={preferredFootIndex(value)}
                onSelect={(index) => onChange(PREFERRED_FOOT_OPTIONS[index])}
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="height_input"
          render={({ field: { value, onChange } }) => (
            <View style={styles.metricField}>
              <Text style={styles.sectionLabel}>HEIGHT</Text>
              <View
                style={[styles.metricUnderline, value.length > 0 && styles.metricUnderlineFocused]}
              >
                <TextInput
                  style={styles.metricValue}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="number-pad"
                  placeholder={units.distance === 'mi' ? '70' : '178'}
                  placeholderTextColor={colors.text.quaternary}
                />
                <Text style={styles.metricUnit}>{heightUnit}</Text>
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="skill_level"
          render={({ field: { value, onChange } }) => (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SKILL LEVEL</Text>
              <View style={styles.chipRow}>
                {SKILL_LEVELS.map((skill) => (
                  <Chip
                    key={skill}
                    label={skill.toUpperCase()}
                    selected={value === skill}
                    onPress={() => onChange(value === skill ? null : skill)}
                    variant="position"
                  />
                ))}
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="visibility"
          render={({ field: { value, onChange } }) => (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>VISIBILITY</Text>
              <SegmentedControl
                options={PROFILE_VISIBILITY_OPTIONS.map((option) => option.toUpperCase())}
                selectedIndex={PROFILE_VISIBILITY_OPTIONS.indexOf(value)}
                onSelect={(index) => onChange(PROFILE_VISIBILITY_OPTIONS[index])}
              />
            </View>
          )}
        />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION</Text>
          <TouchableOpacity
            style={styles.locationButton}
            disabled={locationBusy}
            onPress={() => void captureCurrentLocation()}
          >
            {locationBusy ? (
              <ActivityIndicator color={colors.brand.primary} />
            ) : (
              <Text style={styles.locationButtonText}>
                {location
                  ? `SET · ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                  : 'USE CURRENT LOCATION'}
              </Text>
            )}
          </TouchableOpacity>
          {location ? (
            <TouchableOpacity onPress={() => setLocation(null)}>
              <Text style={styles.clearLocation}>CLEAR LOCATION</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={busy ? 'Saving…' : 'Save Profile'}
          onPress={() => void submit()}
          disabled={busy}
        />
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
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.18 * 9,
    color: colors.text.secondary,
  },
  bioInput: {
    minHeight: 96,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
    paddingBottom: 10,
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    color: colors.text.disabled,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
    paddingBottom: 12,
  },
  positionValue: {
    flex: 1,
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    color: colors.text.primary,
  },
  positionChevron: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    color: colors.brand.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricField: {
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
  locationButton: {
    minHeight: 42,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
    paddingBottom: 10,
  },
  locationButtonText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.brand.primary,
  },
  clearLocation: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    color: colors.text.secondary,
  },
  inlineError: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.accent.danger,
  },
  error: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.accent.danger,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
  },
});
