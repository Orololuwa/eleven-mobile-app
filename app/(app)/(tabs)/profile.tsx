import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '@/providers/app-provider';
import { colors, typography, spacing } from '@/theme';

export default function ProfileRoute() {
  const { user, setUser } = useApp();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.meta}>{user?.firstName?.toUpperCase() || 'PLAYER'}</Text>
        <Text style={styles.meta}>
          {user?.position || 'MID'} · {user?.preferredFoot || 'LEFT'}
        </Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tab} onPress={() => router.push('/(app)/(tabs)')}>
          <Text style={styles.tabText}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => router.push('/(app)/(tabs)/history')}
        >
          <Text style={styles.tabText}>HISTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabTextActive}>PROFILE</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.signOut}
        onPress={() => {
          setUser(null);
          router.replace('/(auth)/sign-in');
        }}
      >
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[8],
    gap: 8,
  },
  title: {
    fontFamily: typography.fontFamily.primary,
    fontSize: 34,
    fontWeight: typography.fontWeight.black,
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  meta: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 12,
    letterSpacing: 0.16 * 12,
    color: colors.text.secondary,
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
  signOut: {
    position: 'absolute',
    right: spacing[6],
    top: spacing[16],
  },
  signOutText: {
    fontFamily: typography.fontFamily.mono,
    fontSize: 11,
    letterSpacing: 0.16 * 11,
    color: colors.accent.danger,
  },
});
