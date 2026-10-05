import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { spacing, typography, type Colors, useColors, useThemedStyles } from '@/theme';
import { SESSION_TITLE_MAX, normalizeSessionTitle } from '@/features/sessions/validation';

type SessionRenameSheetProps = {
  visible: boolean;
  /** The title currently stored as an override; null when the derived title is showing. */
  currentTitle: string | null;
  derivedTitle: string;
  busy: boolean;
  onSave: (title: string | null) => void;
  onDismiss: () => void;
};

export const SessionRenameSheet: React.FC<SessionRenameSheetProps> = ({
  visible,
  currentTitle,
  derivedTitle,
  busy,
  onSave,
  onDismiss,
}) => {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const [draft, setDraft] = useState(currentTitle ?? '');

  useEffect(() => {
    if (visible) setDraft(currentTitle ?? '');
  }, [visible, currentTitle]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.scrim} onPress={onDismiss} disabled={busy} />
        <View style={styles.sheet}>
          <View style={styles.kickerRow}>
            <Text style={styles.kicker}>RENAME</Text>
            <TouchableOpacity onPress={onDismiss} disabled={busy} accessibilityRole="button">
              <Text style={styles.dismiss}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Name this session</Text>
          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>TITLE</Text>
              <Text style={styles.label}>
                {draft.trim().length} / {SESSION_TITLE_MAX}
              </Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                maxLength={SESSION_TITLE_MAX}
                placeholder={derivedTitle}
                placeholderTextColor={colors.text.quaternary}
                editable={!busy}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => onSave(normalizeSessionTitle(draft))}
                accessibilityLabel="Session title"
              />
              {draft.length > 0 ? (
                <TouchableOpacity
                  style={styles.clear}
                  onPress={() => setDraft('')}
                  disabled={busy}
                  accessibilityLabel="Clear title"
                >
                  <Text style={styles.dismiss}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.hint}>
              Clear it to go back to <Text style={styles.hintStrong}>{derivedTitle}</Text>.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.save, busy && styles.saveBusy]}
            onPress={() => onSave(normalizeSessionTitle(draft))}
            disabled={busy}
          >
            <Text style={styles.saveText}>SAVE</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
      borderTopColor: colors.border.medium,
      paddingHorizontal: spacing[6],
      paddingTop: 22,
      paddingBottom: 34,
      gap: 16,
    },
    kickerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    kicker: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 10,
      letterSpacing: 0.24 * 10,
      color: colors.brand.ink,
    },
    dismiss: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 16,
      color: colors.text.secondary,
    },
    title: {
      fontFamily: typography.fontFamily.primary,
      fontSize: 26,
      fontWeight: typography.fontWeight.black,
      letterSpacing: -0.03 * 26,
      color: colors.text.primary,
    },
    fieldBlock: {
      gap: 10,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    label: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 10,
      letterSpacing: 0.16 * 10,
      color: colors.text.secondary,
    },
    inputRow: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.brand.ink,
      backgroundColor: colors.background.secondary,
      paddingLeft: 16,
      paddingRight: 6,
    },
    input: {
      flex: 1,
      fontFamily: typography.fontFamily.primary,
      fontSize: 17,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
    },
    clear: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      fontSize: 14,
      lineHeight: 14 * 1.45,
      color: colors.text.secondary,
    },
    hintStrong: {
      color: colors.text.primary,
    },
    save: {
      height: 60,
      backgroundColor: colors.brand.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBusy: {
      opacity: 0.6,
    },
    saveText: {
      fontFamily: typography.fontFamily.mono,
      fontSize: 14,
      letterSpacing: 0.22 * 14,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.onBrand,
    },
  });
