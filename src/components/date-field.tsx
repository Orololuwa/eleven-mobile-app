import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, typography } from '@/theme';
import {
  defaultBirthDate,
  formatDateOfBirth,
  minBirthDate,
  parseIsoDate,
  startOfToday,
  toIsoDate,
} from '@/features/profile/date';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  error?: string;
};

export const DateField: React.FC<DateFieldProps> = ({
  label,
  value,
  onChange,
  optional = false,
  error,
}) => {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value) ?? defaultBirthDate();
  const hasValue = value.length > 0;

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type !== 'set' || !date) return;
      onChange(toIsoDate(date));
      return;
    }
    if (!date) return;
    onChange(toIsoDate(date));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label.toUpperCase()}
        {optional ? ' — OPTIONAL' : ''}
      </Text>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          open && styles.inputContainerFocused,
          error ? styles.inputContainerError : null,
        ]}
        onPress={() => setOpen((current) => !current)}
        activeOpacity={0.7}
      >
        <Text style={[styles.value, !hasValue && styles.placeholder]}>
          {hasValue ? formatDateOfBirth(value) : 'Select date'}
        </Text>
        <Text style={styles.chevron}>▸</Text>
      </TouchableOpacity>
      {optional && hasValue ? (
        <TouchableOpacity
          onPress={() => {
            onChange('');
            setOpen(false);
          }}
        >
          <Text style={styles.clear}>CLEAR</Text>
        </TouchableOpacity>
      ) : null}
      {open ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          maximumDate={startOfToday()}
          minimumDate={minBirthDate()}
          themeVariant="dark"
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.18 * 9,
    color: colors.text.secondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.medium,
    paddingBottom: 10,
  },
  inputContainerFocused: {
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.primary,
  },
  inputContainerError: {
    borderBottomColor: colors.accent.danger,
  },
  value: {
    flex: 1,
    fontFamily: typography.fontFamily.primary,
    fontSize: 18,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  placeholder: {
    color: colors.text.quaternary,
    fontWeight: typography.fontWeight.regular,
  },
  chevron: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    color: colors.brand.primary,
  },
  clear: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    color: colors.text.secondary,
  },
  error: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.accent.danger,
  },
});
