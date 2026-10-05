import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spacing, typography, type Colors, useThemedStyles } from '@/theme';

type SessionDeleteSheetProps = {
  visible: boolean;
  /** The phone holds the only copy (sync was rejected). */
  isOnlyCopy: boolean;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};

export const SessionDeleteSheet: React.FC<SessionDeleteSheetProps> = ({
  visible,
  isOnlyCopy,
  busy,
  onConfirm,
  onDismiss,
}) => {
  const styles = useThemedStyles(createStyles);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.scrim} onPress={onDismiss} disabled={busy} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>DELETE SESSION</Text>
          <Text style={styles.title}>Delete this session?</Text>
          <Text style={styles.body}>
            {isOnlyCopy
              ? "It never reached Eleven's servers, so this phone has the only copy. Deleting it removes it for good."
              : "Its stats and GPS trace will be permanently removed. This can't be undone."}
          </Text>
          <TouchableOpacity
            style={[styles.confirm, busy && styles.busy]}
            onPress={onConfirm}
            disabled={busy}
          >
            <Text style={styles.confirmText}>{isOnlyCopy ? 'DELETE FOR GOOD' : 'DELETE'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onDismiss} disabled={busy}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay.medium,
    },
    scrim: {
      flex: 1,
    },
    sheet: {
      backgroundColor: colors.background.elevated,
      borderTopWidth: 1,
      borderTopColor: colors.accent.danger,
      paddingHorizontal: spacing[6],
      paddingTop: 22,
      paddingBottom: 34,
      gap: 16,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      backgroundColor: colors.border.strong,
    },
    kicker: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 10,
      letterSpacing: 0.24 * 10,
      color: colors.accent.danger,
    },
    title: {
      fontFamily: typography.fontFamily.primary,
      fontSize: 26,
      fontWeight: typography.fontWeight.black,
      letterSpacing: -0.03 * 26,
      color: colors.text.primary,
    },
    body: {
      fontSize: 15,
      lineHeight: 15 * 1.5,
      color: colors.text.secondary,
    },
    confirm: {
      height: 56,
      backgroundColor: colors.accent.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    busy: {
      opacity: 0.6,
    },
    confirmText: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 13,
      letterSpacing: 0.22 * 13,
      fontWeight: typography.fontWeight.semibold,
      color: colors.background.secondary,
    },
    cancel: {
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 12,
      letterSpacing: 0.22 * 12,
      color: colors.text.secondary,
    },
  });
