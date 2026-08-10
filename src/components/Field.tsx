import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, typography } from '@/theme';

type FieldProps = TextInputProps & {
  label: string;
  error?: string;
  focused?: boolean;
  optional?: boolean;
};

export const Field: React.FC<FieldProps> = ({
  label,
  error,
  focused = false,
  optional = false,
  value,
  placeholder,
  ...props
}) => {
  const hasValue = value && value.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label.toUpperCase()}
        {optional && ' — OPTIONAL'}
      </Text>
      <View
        style={[
          styles.inputContainer,
          focused && styles.inputContainerFocused,
          error && styles.inputContainerError,
        ]}
      >
        <TextInput
          style={[
            styles.input,
            hasValue && styles.inputFilled,
            !hasValue && styles.inputEmpty,
          ]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor={colors.text.quaternary}
          {...props}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
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
  input: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 18,
    color: colors.text.primary,
    padding: 0,
  },
  inputFilled: {
    fontWeight: typography.fontWeight.semibold,
  },
  inputEmpty: {
    color: colors.text.quaternary,
  },
  error: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.accent.danger,
  },
});
