import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';

type LinkConflictScreenProps = {
  currentMethodsLabel?: string;
  currentSessions?: number;
  otherSessions?: number;
  onBack: () => void;
  onKeepCurrent: () => void;
  onSwitchAccount: () => void;
};

export const LinkConflictScreen: React.FC<LinkConflictScreenProps> = ({
  currentMethodsLabel = 'GOOGLE · EMAIL',
  currentSessions = 53,
  otherSessions = 6,
  onBack,
  onKeepCurrent,
  onSwitchAccount,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Text style={styles.backText}>◂ SIGN-IN METHODS</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.badgeRow}>
          <View style={styles.badge} />
          <Text style={styles.badgeText}>CAN'T LINK</Text>
        </View>

        <Text style={styles.title}>
          That Apple ID is{'\n'}already an Eleven{'\n'}account.
        </Text>
        <Text style={styles.body}>
          It has its own wall. Joining them would bury one, so the choice is yours — not ours.
        </Text>

        <TouchableOpacity style={[styles.card, styles.cardActive]} onPress={onKeepCurrent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>SIGNED IN NOW</Text>
            <Text style={styles.cardMeta}>{currentMethodsLabel}</Text>
          </View>
          <Text style={styles.cardValue}>{currentSessions} sessions</Text>
          <Text style={styles.cardActionActive}>KEEP THIS ONE — APPLE STAYS OFF</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={onSwitchAccount}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>THE APPLE ACCOUNT</Text>
            <Text style={styles.cardMeta}>APPLE</Text>
          </View>
          <Text style={styles.cardValue}>{otherSessions} sessions</Text>
          <Text style={styles.cardAction}>SIGN OUT AND OPEN THAT ONE</Text>
        </TouchableOpacity>

        <View style={styles.note}>
          <View style={styles.noteBar} />
          <Text style={styles.noteText}>
            Nothing is deleted either way. Merging two walls isn't automatic yet — mail us and we'll
            do it by hand.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  backRow: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[2],
  },
  backText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  badge: {
    width: 8,
    height: 8,
    backgroundColor: colors.accent.danger,
  },
  badgeText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.accent.danger,
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
  card: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  cardActive: {
    borderColor: colors.brand.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  cardMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
  },
  cardValue: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 28,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  cardActionActive: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    color: colors.brand.primary,
  },
  cardAction: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    color: colors.text.primary,
  },
  note: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing[4],
  },
  noteBar: {
    width: 2,
    backgroundColor: colors.accent.danger,
  },
  noteText: {
    flex: 1,
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.text.secondary,
  },
});
