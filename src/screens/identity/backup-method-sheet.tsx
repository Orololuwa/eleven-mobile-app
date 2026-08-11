import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Button } from '@/components';
import { colors, typography, spacing } from '@/theme';

type BackupMethodSheetProps = {
  visible: boolean;
  providerLabel?: string;
  onAddApple: () => void;
  onAddEmail: () => void;
  onDismiss: () => void;
};

export const BackupMethodSheet: React.FC<BackupMethodSheetProps> = ({
  visible,
  providerLabel = 'Google',
  onAddApple,
  onAddEmail,
  onDismiss,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.eyebrow}>ONE BRICK IN · ASKED ONCE</Text>
          <Text style={styles.title}>Add a second{'\n'}way in.</Text>
          <Text style={styles.body}>
            You're signed in with {providerLabel}. A backup method means a new phone never costs you
            the wall.
          </Text>

          <View style={styles.actions}>
            <Button title="Add Apple" onPress={onAddApple} />
            <Button title="Add Email Code" variant="secondary" onPress={onAddEmail} />
            <TouchableOpacity onPress={onDismiss}>
              <Text style={styles.notNow}>NOT NOW</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>ALWAYS AVAILABLE IN PROFILE → SIGN-IN METHODS</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.medium,
  },
  sheet: {
    backgroundColor: colors.background.secondary,
    borderTopWidth: 2,
    borderTopColor: colors.brand.primary,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 3,
    backgroundColor: colors.border.medium,
    marginBottom: spacing[5],
  },
  eyebrow: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.brand.primary,
    marginBottom: 14,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 34,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.03 * 34,
    lineHeight: 34 * 1.05,
    color: colors.text.primary,
    marginBottom: 14,
  },
  body: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    lineHeight: 16 * 1.5,
    color: colors.text.secondary,
    marginBottom: spacing[7],
  },
  actions: {
    gap: 12,
  },
  notNow: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.14 * 12,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 10,
  },
  footer: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: spacing[5],
  },
});
