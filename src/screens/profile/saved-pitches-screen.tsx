import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';
import type { SavedPitch } from '@/types/profile';

type SavedPitchesScreenProps = {
  pitches: SavedPitch[];
  onBack: () => void;
  onRemove: (id: string) => void;
};

export const SavedPitchesScreen: React.FC<SavedPitchesScreenProps> = ({
  pitches,
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

        {pitches.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No grounds yet.</Text>
            <Text style={styles.emptyBody}>
              The first time you mark four corners, Eleven keeps the pitch here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {pitches.map((pitch) => (
              <View key={pitch.id} style={styles.card}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{pitch.name}</Text>
                  <Text style={styles.cardMeta}>
                    {pitch.size} · {pitch.sessions} SESSIONS
                  </Text>
                </View>
                <TouchableOpacity onPress={() => onRemove(pitch.id)}>
                  <Text style={styles.remove}>REMOVE</Text>
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
    paddingTop: spacing[6],
    paddingBottom: spacing[8],
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
    marginBottom: spacing[7],
  },
  list: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardCopy: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 17,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  cardMeta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    color: colors.text.secondary,
  },
  remove: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  empty: {
    gap: 12,
    paddingTop: spacing[4],
  },
  emptyTitle: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 24,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  emptyBody: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.text.secondary,
  },
});
