import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark, Button } from '../components';
import { colors, typography, spacing } from '../theme';

type SignInScreenProps = {
  onContinueWithApple: () => void;
  onContinueWithGoogle: () => void;
  onUseEmail: () => void;
};

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onContinueWithApple,
  onContinueWithGoogle,
  onUseEmail,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <BrandMark size="medium" variant="light" withText />
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroBackground}>
            <Text style={styles.heroPlaceholder}>
              [ FULL-BLEED PHOTO ]{'\n'}
              NIGHT FLOODLIGHTS, 5-A-SIDE CAGE
            </Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>
              Everyone sees{'\n'}the match.
            </Text>
            <Text style={styles.heroTitleAccent}>
              Nobody sees{'\n'}the work.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Continue with Apple"
            onPress={onContinueWithApple}
            variant="primary"
            style={styles.appleButton}
          />
          <Button
            title="Continue with Google"
            onPress={onContinueWithGoogle}
            variant="secondary"
          />
          <Button
            title="Use Email Instead"
            onPress={onUseEmail}
            variant="ghost"
          />
          <Text style={styles.footer}>JOIN PROJECT ELEVEN</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing[8],
    paddingTop: spacing[7],
  },
  hero: {
    flex: 1,
    position: 'relative',
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    // Add pattern background
    opacity: 0.8,
  },
  heroPlaceholder: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.18 * 11,
    color: colors.text.disabled,
    textAlign: 'center',
    lineHeight: 1.9 * 11,
  },
  heroText: {
    position: 'absolute',
    bottom: spacing[8],
    left: spacing[8],
    right: spacing[8],
    gap: 12,
  },
  heroTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 44,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.04 * 44,
    lineHeight: 44 * 0.95,
    color: colors.text.primary,
  },
  heroTitleAccent: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 44,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.04 * 44,
    lineHeight: 44 * 0.95,
    color: colors.brand.primary,
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[9],
    gap: 12,
    backgroundColor: colors.background.secondary,
    paddingTop: spacing[7],
  },
  appleButton: {
    backgroundColor: colors.text.primary,
  },
  footer: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.24 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
    marginTop: 6,
  },
});
