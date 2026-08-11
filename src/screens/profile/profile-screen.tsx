import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '@/theme';
import { displayName, profileMetaLine, type ProfileData, type UnitsPreference } from '@/types/profile';

type ProfileMenuItem = {
  key: string;
  label: string;
  value?: string;
  accent?: boolean;
  onPress: () => void;
};

type ProfileScreenProps = {
  user: ProfileData | null;
  sessionCount: number;
  totalKm: number;
  totalHours: number;
  units: UnitsPreference;
  signInSummary: string;
  savedPitchCount: number;
  onNavigateToHome: () => void;
  onNavigateToHistory: () => void;
  onPlayerDetails: () => void;
  onSignInMethods: () => void;
  onUnits: () => void;
  onSavedPitches: () => void;
  onPrivacyData: () => void;
  onSignOut: () => void;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  sessionCount,
  totalKm,
  totalHours,
  units,
  signInSummary,
  savedPitchCount,
  onNavigateToHome,
  onNavigateToHistory,
  onPlayerDetails,
  onSignInMethods,
  onUnits,
  onSavedPitches,
  onPrivacyData,
  onSignOut,
}) => {
  const name = displayName(user);
  const meta = profileMetaLine(user);
  const distanceLabel = units.distance.toUpperCase();
  const massLabel = units.mass.toUpperCase();

  const menuItems: ProfileMenuItem[] = [
    {
      key: 'player',
      label: 'Player Details',
      value: `${user?.position || 'MID'} · ${user?.preferredFoot || 'LEFT'}`,
      accent: true,
      onPress: onPlayerDetails,
    },
    {
      key: 'signin',
      label: 'Sign-in Methods',
      value: signInSummary,
      onPress: onSignInMethods,
    },
    {
      key: 'units',
      label: 'Units',
      value: `${distanceLabel} · ${massLabel}`,
      onPress: onUnits,
    },
    {
      key: 'pitches',
      label: 'Saved Pitches',
      value: `${savedPitchCount} GROUND${savedPitchCount === 1 ? '' : 'S'}`,
      onPress: onSavedPitches,
    },
    {
      key: 'privacy',
      label: 'Privacy & Data',
      onPress: onPrivacyData,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <View style={styles.avatarInner} />
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>{meta}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>SESSIONS</Text>
            <Text style={styles.statValue}>{sessionCount}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>{distanceLabel}</Text>
            <Text style={styles.statValue}>{totalKm}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>HOURS</Text>
            <Text style={styles.statValue}>{totalHours}</Text>
          </View>
        </View>

        <View style={styles.menu}>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.key} style={styles.menuRow} onPress={item.onPress}>
              <Text style={[styles.menuLabel, item.accent && styles.menuLabelAccent]}>
                {item.label.toUpperCase()}
              </Text>
              <View style={styles.menuRight}>
                {item.value ? (
                  <Text style={[styles.menuValue, item.accent && styles.menuValueAccent]}>
                    {item.value}
                  </Text>
                ) : null}
                <Text style={[styles.menuChevron, item.accent && styles.menuValueAccent]}>▸</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.build}>ELEVEN 0.1 · BUILD 118</Text>

        <TouchableOpacity style={styles.signOut} onPress={onSignOut}>
          <Text style={styles.signOutText}>SIGN OUT</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={onNavigateToHome}>
          <Text style={styles.tabText}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab} onPress={onNavigateToHistory}>
          <Text style={styles.tabText}>HISTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabTextActive}>PROFILE</Text>
        </TouchableOpacity>
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
    paddingHorizontal: spacing[6],
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 34,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
    marginTop: spacing[4],
    marginBottom: spacing[6],
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: spacing[6],
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.border.strong,
    overflow: 'hidden',
  },
  avatarInner: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  identityCopy: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 22,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  meta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.14 * 11,
    color: colors.text.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing[4],
  },
  statCell: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: spacing[4],
    gap: 8,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border.subtle,
  },
  statLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 9,
    letterSpacing: 0.16 * 9,
    color: colors.text.secondary,
  },
  statValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 28,
    letterSpacing: -0.02 * 28,
    color: colors.text.primary,
  },
  menu: {
    marginTop: spacing[2],
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  menuLabel: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.14 * 12,
    color: colors.text.primary,
  },
  menuLabelAccent: {
    color: colors.brand.primary,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuValue: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.12 * 11,
    color: colors.text.secondary,
  },
  menuValueAccent: {
    color: colors.brand.primary,
  },
  menuChevron: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 14,
    color: colors.text.secondary,
  },
  build: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.14 * 10,
    color: colors.text.disabled,
    marginTop: spacing[8],
    marginBottom: spacing[5],
  },
  signOut: {
    alignSelf: 'flex-start',
    marginBottom: spacing[8],
    paddingVertical: 8,
  },
  signOutText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.16 * 12,
    color: colors.accent.danger,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: 16,
    height: 76,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.text.disabled,
  },
  tabTextActive: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 10,
    letterSpacing: 0.16 * 10,
    color: colors.brand.primary,
  },
});
