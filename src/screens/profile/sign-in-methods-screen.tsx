import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components';
import { colors, typography, spacing } from '@/theme';
import type { SignInMethod } from '@/types/profile';

type SignInMethodsScreenProps = {
  methods: SignInMethod[];
  onBack: () => void;
  onAdd: (id: SignInMethod['id']) => void;
  onRemove: (id: SignInMethod['id']) => void;
  onSignOut: () => void;
};

export const SignInMethodsScreen: React.FC<SignInMethodsScreenProps> = ({
  methods,
  onBack,
  onAdd,
  onRemove,
  onSignOut,
}) => {
  const connectedCount = methods.filter((method) => method.connected).length;

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
        <View style={styles.header}>
          <Text style={styles.title}>Sign-in methods</Text>
          <Text style={styles.description}>
            Any of these opens the same account. Same wall, same history, whichever you press.
          </Text>
        </View>

        <View style={styles.list}>
          {methods.map((method) => {
            const isLastConnected = method.connected && connectedCount === 1;
            return (
              <View
                key={method.id}
                style={[styles.card, !method.connected && styles.cardHighlight]}
              >
                <View style={styles.cardLeft}>
                  <View
                    style={[styles.indicator, method.connected ? styles.indicatorOn : styles.indicatorOff]}
                  />
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardLabel}>{method.label.toUpperCase()}</Text>
                    <Text style={styles.cardMeta}>
                      {method.connected ? method.email : 'Not connected'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  {method.connected && method.since ? (
                    <Text style={styles.since}>SINCE {method.since}</Text>
                  ) : null}
                  {method.connected ? (
                    <TouchableOpacity
                      onPress={() => onRemove(method.id)}
                      disabled={isLastConnected}
                    >
                      <Text
                        style={[styles.action, isLastConnected && styles.actionDisabled]}
                      >
                        REMOVE
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => onAdd(method.id)}>
                      <Text style={styles.actionAdd}>ADD</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.note}>
          <View style={styles.noteBar} />
          <Text style={styles.noteText}>
            One method has to stay. Remove the last one and there's no door back in.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Sign Out" variant="secondary" onPress={onSignOut} />
        <Text style={styles.footerNote}>SESSIONS STAY ON THE ACCOUNT, NOT THE PHONE</Text>
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
    paddingBottom: spacing[2],
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
    paddingBottom: spacing[6],
  },
  header: {
    gap: 14,
    marginBottom: spacing[7],
    marginTop: spacing[4],
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 36,
    fontWeight: typography.fontWeight.black,
    letterSpacing: -0.035 * 36,
    color: colors.text.primary,
  },
  description: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 16,
    lineHeight: 16 * 1.5,
    color: colors.text.secondary,
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
    gap: 12,
  },
  cardHighlight: {
    borderColor: colors.brand.primary,
  },
  cardLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  indicator: {
    width: 10,
    height: 10,
    marginTop: 4,
  },
  indicatorOn: {
    backgroundColor: colors.brand.primary,
  },
  indicatorOff: {
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  cardCopy: {
    gap: 6,
    flex: 1,
  },
  cardLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 13,
    letterSpacing: 0.14 * 13,
    color: colors.text.primary,
  },
  cardMeta: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 14,
    color: colors.text.secondary,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 10,
  },
  since: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.12 * 10,
    color: colors.text.disabled,
  },
  action: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  actionDisabled: {
    color: colors.text.dimmed,
  },
  actionAdd: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.brand.primary,
  },
  note: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing[6],
  },
  noteBar: {
    width: 2,
    backgroundColor: colors.border.medium,
  },
  noteText: {
    flex: 1,
    fontFamily: typography.fontFamily.primary,
    fontSize: 15,
    lineHeight: 15 * 1.5,
    color: colors.text.secondary,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[6],
    gap: 14,
  },
  footerNote: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
    textAlign: 'center',
  },
});
