import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../theme';

type Step = 'email' | 'code';

type EmailSignInScreenProps = {
  onBack: () => void;
  onVerified: () => void;
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const EmailSignInScreen: React.FC<EmailSignInScreenProps> = ({
  onBack,
  onVerified,
}) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(24);

  const emailInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);

  // Countdown timer for resend
  useEffect(() => {
    if (step !== 'code') return;
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendCountdown]);

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (code.length === 6) {
      // Small delay so user sees the last digit
      const t = setTimeout(() => onVerified(), 400);
      return () => clearTimeout(t);
    }
  }, [code]);

  const handleSendCode = () => {
    if (!isValidEmail(email)) return;
    setStep('code');
    setResendCountdown(24);
    setTimeout(() => codeInputRef.current?.focus(), 300);
  };

  const handleNumPad = (digit: string) => {
    if (digit === '⌫') {
      setCode((v) => v.slice(0, -1));
    } else if (code.length < 6) {
      setCode((v) => v + digit);
    }
  };

  if (step === 'email') {
    const valid = isValidEmail(email);
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Status bar */}
          <View style={styles.statusBar}>
            <Text style={styles.time}>9:41</Text>
            <Text style={styles.statusIcons}>▮▮▮ ⌁ ▰</Text>
          </View>

          {/* Back */}
          <TouchableOpacity style={styles.backRow} onPress={onBack}>
            <Text style={styles.backText}>◂ BACK</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.emailHeader}>
            <Text style={styles.screenTitle}>What's your email?</Text>
            <Text style={styles.screenDesc}>
              We'll send a six-digit code. No password to forget.
            </Text>
          </View>

          {/* Email field */}
          <View style={styles.emailFieldSection}>
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <View style={[styles.emailField, valid && styles.emailFieldValid]}>
              <TextInput
                ref={emailInputRef}
                style={styles.emailInput}
                value={email}
                onChangeText={setEmail}
                autoFocus
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
                selectionColor={colors.brand.primary}
                placeholderTextColor={colors.text.disabled}
                placeholder="you@example.com"
              />
            </View>
            <Text style={styles.privacyNote}>WE NEVER POST ANYTHING. EVER.</Text>
          </View>

          <View style={styles.spacer} />

          {/* Send Code */}
          <View style={styles.emailActions}>
            <TouchableOpacity
              style={[styles.sendCodeButton, valid && styles.sendCodeButtonActive]}
              onPress={handleSendCode}
              disabled={!valid}
            >
              <Text style={[styles.sendCodeText, valid && styles.sendCodeTextActive]}>
                SEND CODE
              </Text>
            </TouchableOpacity>
            {!valid && (
              <Text style={styles.disabledNote}>
                DISABLED UNTIL THE ADDRESS IS VALID
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Code verification step
  const codeDigits = Array.from({ length: 6 }, (_, i) => code[i] ?? '');

  return (
    <SafeAreaView style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.time}>9:41</Text>
        <Text style={styles.statusIcons}>▮▮▮ ⌁ ▰</Text>
      </View>

      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={() => setStep('email')}>
        <Text style={styles.backText}>◂ CHANGE EMAIL</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.emailHeader}>
        <Text style={styles.screenTitle}>Check your inbox.</Text>
        <Text style={styles.screenDesc}>
          Six digits sent to{' '}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>
      </View>

      {/* 6-digit boxes */}
      <View style={styles.codeBoxRow}>
        {codeDigits.map((digit, i) => {
          const isCurrent = i === code.length;
          const isFilled = i < code.length;
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.codeBox,
                isFilled && styles.codeBoxFilled,
                isCurrent && styles.codeBoxActive,
              ]}
              onPress={() => codeInputRef.current?.focus()}
              activeOpacity={1}
            >
              {isCurrent ? (
                <View style={styles.codeCursor} />
              ) : (
                <Text style={styles.codeDigit}>{digit}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hidden input to capture keyboard */}
      <TextInput
        ref={codeInputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
      />

      {/* Resend / paste */}
      <View style={styles.codeActions}>
        <Text style={styles.resendText}>
          {resendCountdown > 0
            ? `RESEND IN 0:${String(resendCountdown).padStart(2, '0')}`
            : 'RESEND CODE'}
        </Text>
        <TouchableOpacity>
          <Text style={styles.pasteText}>PASTE FROM MAIL</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />

      {/* Custom numpad */}
      <View style={styles.numPad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(
          (key, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.numKey, key === '' && styles.numKeyEmpty]}
              onPress={() => key !== '' && handleNumPad(key)}
              disabled={key === ''}
              activeOpacity={key === '' ? 1 : 0.6}
            >
              <Text
                style={[
                  styles.numKeyText,
                  key === '⌫' && styles.numKeyBackspace,
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  flex: {
    flex: 1,
  },
  statusBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
  },
  time: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    color: colors.text.primary,
  },
  statusIcons: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    color: colors.text.secondary,
  },
  backRow: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[2],
  },
  backText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.text.secondary,
  },
  emailHeader: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[9],
    gap: 14,
  },
  screenTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 36,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 36,
    lineHeight: 36 * 1.02,
    color: colors.text.primary,
  },
  screenDesc: {
    fontSize: 16,
    color: colors.text.secondary,
    lineHeight: 16 * 1.5,
  },
  emailHighlight: {
    color: colors.text.primary,
  },
  emailFieldSection: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[9],
    gap: 12,
  },
  fieldLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.18 * 9,
    color: colors.text.secondary,
  },
  emailField: {
    borderBottomWidth: 2,
    borderBottomColor: colors.border.strong,
    paddingBottom: 12,
  },
  emailFieldValid: {
    borderBottomColor: colors.brand.primary,
  },
  emailInput: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 22,
    color: colors.text.primary,
  },
  privacyNote: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
  },
  spacer: {
    flex: 1,
  },
  emailActions: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[4],
    gap: 12,
  },
  sendCodeButton: {
    height: 58,
    backgroundColor: '#2A2E29',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCodeButtonActive: {
    backgroundColor: colors.brand.primary,
  },
  sendCodeText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    letterSpacing: 0.2 * 13,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
  },
  sendCodeTextActive: {
    color: colors.background.secondary,
  },
  disabledNote: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
  },
  // Code step
  codeBoxRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[10],
    gap: 10,
  },
  codeBox: {
    flex: 1,
    height: 68,
    borderWidth: 1,
    borderColor: colors.border.medium,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFilled: {
    borderColor: colors.border.medium,
  },
  codeBoxActive: {
    borderWidth: 2,
    borderColor: colors.brand.primary,
  },
  codeDigit: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 30,
    color: colors.text.primary,
  },
  codeCursor: {
    width: 2,
    height: 30,
    backgroundColor: colors.brand.primary,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  resendText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.disabled,
  },
  pasteText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  // Numpad
  numPad: {
    backgroundColor: colors.background.elevated,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingHorizontal: spacing[6],
    paddingTop: 14,
    paddingBottom: 30,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  numKey: {
    width: '30%',
    flexGrow: 1,
    height: 52,
    backgroundColor: '#262925',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  numKeyEmpty: {
    backgroundColor: 'transparent',
  },
  numKeyText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 22,
    color: colors.text.primary,
  },
  numKeyBackspace: {
    fontSize: 18,
    color: colors.text.secondary,
  },
});
