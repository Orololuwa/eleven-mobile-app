import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components';
import { colors, typography, spacing } from '@/theme';

type FindWallScreenProps = {
  onClose: () => void;
  onContinueGoogle: () => void;
  onUseEmail: () => void;
  onStayNew: () => void;
};

export const FindWallScreen: React.FC<FindWallScreenProps> = ({
  onClose,
  onContinueGoogle,
  onUseEmail,
  onStayNew,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.closeRow} onPress={onClose}>
        <Text style={styles.closeText}>✕ CLOSE</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Find your wall.</Text>
        <Text style={styles.body}>
          Apple lets you hide your email, so Eleven never guesses which account you are — it starts
          a clean one instead.
        </Text>
        <Text style={styles.body}>If you've played before, come back in the way you started.</Text>

        <View style={styles.actions}>
          <Button title="Continue with Google" variant="secondary" onPress={onContinueGoogle} />
          <Button title="Use an Email Code" variant="secondary" onPress={onUseEmail} />
          <TouchableOpacity onPress={onStayNew}>
            <Text style={styles.stayNew}>NO — I'M NEW HERE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tip}>
          <Text style={styles.tipLabel}>SO IT NEVER HAPPENS AGAIN</Text>
          <Text style={styles.tipBody}>
            Once you're back in, add Apple from Profile → Sign-in methods. After that, Apple opens
            the right wall every time.
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        SIGNING IN ANOTHER WAY DELETES NOTHING.{'\n'}THE EMPTY ACCOUNT JUST SITS THERE.
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  closeRow: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  closeText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 36,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 36,
    color: colors.text.primary,
    marginBottom: 14,
  },
  body: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    lineHeight: 16 * 1.5,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  actions: {
    marginTop: spacing[6],
    gap: 12,
  },
  stayNew: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.14 * 12,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: 10,
  },
  tip: {
    marginTop: spacing[8],
    borderWidth: 1,
    borderColor: colors.brand.primary,
    padding: 16,
    gap: 10,
  },
  tipLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.brand.primary,
  },
  tipBody: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.text.secondary,
  },
  footer: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    lineHeight: 10 * 1.6,
  },
});
