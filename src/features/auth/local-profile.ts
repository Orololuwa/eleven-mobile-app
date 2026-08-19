import * as SecureStore from 'expo-secure-store';
import type { ProfileData } from '@/types/profile';

const keyFor = (userId: string) => `eleven.profile.${userId}`;

export const loadLocalProfile = async (userId: string) => {
  const raw = await SecureStore.getItemAsync(keyFor(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProfileData;
  } catch {
    return null;
  }
};

export const saveLocalProfile = (userId: string, profile: ProfileData) =>
  SecureStore.setItemAsync(keyFor(userId), JSON.stringify(profile));
