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

type SavedPitchesScreenProps = {
  pitches: PitchRead[];
  loading?: boolean;
  busyId?: string | null;
  error?: string | null;
  onBack: () => void;
  onRemove: (id: string) => void;
};

export const SavedPitchesScreen: React.FC<SavedPitchesScreenProps> = ({
  pitches,
  loading = false,
  busyId = null,
  error = null,
  onBack,
  onRemove,
}) => {
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
        <Text style={styles.title}>Saved pitches</Text>
        <Text style={styles.description}>
          Marked once per ground. Next visit is a single tap — or skip and track without a heatmap.
        </Text>

        {loading ? <ActivityIndicator color={colors.brand.primary} style={styles.loader} /> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && pitches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No grounds yet.</Text>
            <Text style={styles.emptyBody}>
              The first time you mark Home and Away ends, Eleven keeps the pitch here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {pitches.map((pitch) => (
              <View key={pitch.id} style={styles.card}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{pitch.name}</Text>
                  <Text style={styles.cardMeta}>{pitch.visibility.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => onRemove(pitch.id)} disabled={busyId === pitch.id}>
                  <Text style={styles.remove}>{busyId === pitch.id ? '…' : 'REMOVE'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
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
  loader: {
    marginTop: spacing[6],
  },
  error: {
    fontSize: 14,
    color: colors.accent.danger,
  },
  empty: {
    marginTop: spacing[8],
    gap: 10,
  },
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
  list: {
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
    gap: 6,
    marginRight: 12,
  },
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
  remove: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.accent.danger,
  },
});
