import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';
import type { PitchRead } from '@/features/pitches/types';

type SelectSavedPitchScreenProps = {
  pitches: PitchRead[];
  loading?: boolean;
  error?: string | null;
  onBack: () => void;
  onSelect: (pitch: PitchRead) => void;
};

export const SelectSavedPitchScreen: React.FC<SelectSavedPitchScreenProps> = ({
  pitches,
  loading = false,
  error = null,
  onBack,
  onSelect,
}) => (
  <SafeAreaView style={styles.container}>
    <TouchableOpacity style={styles.backRow} onPress={onBack}>
      <Text style={styles.backText}>◂ BACK</Text>
    </TouchableOpacity>

    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentInner}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Saved pitches</Text>
      <Text style={styles.description}>
        Pick a ground you&apos;ve already marked. Home and Away ends geometry comes with it.
      </Text>

      {loading ? <ActivityIndicator color={colors.brand.primary} style={styles.loader} /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && pitches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No grounds yet.</Text>
          <Text style={styles.emptyBody}>
            Mark Home and Away ends once, and Eleven keeps the pitch here for next time.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {pitches.map((pitch) => (
            <TouchableOpacity
              key={pitch.id}
              style={styles.card}
              onPress={() => onSelect(pitch)}
              activeOpacity={0.7}
            >
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{pitch.name}</Text>
                <Text style={styles.cardMeta}>{pitch.visibility.toUpperCase()}</Text>
              </View>
              <Text style={styles.select}>USE</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  </SafeAreaView>
);

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
  content: { flex: 1 },
  contentInner: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    paddingBottom: spacing[9],
    gap: 16,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 30,
    fontWeight: typography.fontWeight.extrabold,
    letterSpacing: -0.025 * 30,
    color: colors.text.primary,
  },
  description: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
  loader: { marginTop: spacing[6] },
  error: {
    fontSize: 14,
    color: colors.accent.danger,
  },
  empty: { marginTop: spacing[8], gap: 10 },
  emptyTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  emptyBody: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 15 * 1.5,
  },
  list: { gap: 10 },
  card: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCopy: { flex: 1, gap: 6, marginRight: 12 },
  cardTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 18,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  cardMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.secondary,
  },
  select: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.brand.primary,
  },
});
