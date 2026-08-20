import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LogoText, Button } from '@/components';
import { colors, typography, spacing } from '@/theme';

const WOODSMOKE = colors.background.primary; // #060706

type SignInProvider = 'apple' | 'google' | 'email';

type SignInScreenProps = {
  onContinueWithApple: () => void;
  onContinueWithGoogle: () => void;
  onUseEmail: () => void;
  busyProvider?: SignInProvider | null;
  errorMessage?: string | null;
};

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onContinueWithApple,
  onContinueWithGoogle,
  onUseEmail,
  busyProvider = null,
  errorMessage = null,
}) => {
  const busy = Boolean(busyProvider);

  return (
    <View style={styles.container}>
      <Image
        source={require('@assets/hero-bg.png')}
        style={styles.heroBackground}
        resizeMode="cover"
      />
      <View style={styles.heroOverlay} pointerEvents="none" />

      <SafeAreaView style={styles.content}>
        <View style={styles.header}>
          <LogoText width={139} />
        </View>

        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Everyone sees{'\n'}the match.</Text>
          <Text style={styles.heroTitleAccent}>Nobody sees{'\n'}the work.</Text>
        </View>

        <LinearGradient
          colors={['transparent', 'transparent']}
          locations={[0, 1]}
          style={styles.actionsGradient}
        >
          <View style={styles.actions}>
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Button
              title="Continue with Apple"
              onPress={onContinueWithApple}
              variant="primary"
              style={styles.appleButton}
              loading={busyProvider === 'apple'}
              disabled={busy && busyProvider !== 'apple'}
              icon={
                <Image
                  source={require('@assets/icons8-apple-50.png')}
                  style={styles.providerIcon}
                  resizeMode="contain"
                />
              }
            />
            <Button
              title="Continue with Google"
              onPress={onContinueWithGoogle}
              variant="secondary"
              loading={busyProvider === 'google'}
              disabled={busy && busyProvider !== 'google'}
              icon={
                <Image
                  source={require('@assets/icons8-google-48.png')}
                  style={styles.providerIcon}
                  resizeMode="contain"
                />
              }
            />
            <Button
              title="Continue with email"
              onPress={onUseEmail}
              variant="ghost"
              disabled={busy}
            />
            <Text style={styles.footer}>JOIN PROJECT ELEVEN</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WOODSMOKE,
    overflow: 'hidden',
  },
  heroBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.light,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: spacing[8],
    paddingTop: spacing[7],
  },
  heroText: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[6],
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
  actionsGradient: {
    paddingTop: spacing[10],
  },
  actions: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[9],
    gap: 12,
  },
  appleButton: {
    backgroundColor: colors.text.primary,
  },
  providerIcon: {
    width: 20,
    height: 20,
  },
  error: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    lineHeight: 14 * 1.4,
    color: colors.accent.danger,
    textAlign: 'center',
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
