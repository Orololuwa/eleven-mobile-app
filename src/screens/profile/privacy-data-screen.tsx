import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';

type PrivacyDataScreenProps = {
  onBack: () => void;
};

export const PrivacyDataScreen: React.FC<PrivacyDataScreenProps> = ({ onBack }) => {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <Text style={styles.backText}>◂ PROFILE</Text>
      </TouchableOpacity>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Privacy & data</Text>
        <Text style={styles.description}>
          Eleven never posts anything. Sessions live on your account — not on the phone.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>LOCATION</Text>
          <Text style={styles.cardBody}>
            GPS is used only while a session is live, to build distance, speed and heatmaps. It is
            not shared socially.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ACCOUNT</Text>
          <Text style={styles.cardBody}>
            Sign-in methods open the same wall. Removing a method never deletes sessions — only
            losing every method locks the door.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>EXPORT / DELETE</Text>
          <Text style={styles.cardBody}>
            Full export and account deletion ship after Release 01. Until then, mail support and
            we'll handle it by hand.
          </Text>
        </View>
      </ScrollView>
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
  },
  contentInner: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
    gap: 14,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 36,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 36,
    color: colors.text.primary,
    marginBottom: 14,
  },
  description: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    lineHeight: 16 * 1.5,
    color: colors.text.secondary,
    marginBottom: spacing[4],
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 16,
    gap: 10,
  },
  cardLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.brand.primary,
  },
  cardBody: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.text.secondary,
  },
});
