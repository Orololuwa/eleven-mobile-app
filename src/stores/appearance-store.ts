import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type AppearancePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'eleven.appearance';

const isPreference = (value: string | null): value is AppearancePreference =>
  value === 'system' || value === 'light' || value === 'dark';

const readStoredPreference = (): AppearancePreference => {
  try {
    const stored = SecureStore.getItem(STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

const writeStoredPreference = (preference: AppearancePreference) => {
  try {
    SecureStore.setItem(STORAGE_KEY, preference);
  } catch {
    // Preference still applies for this launch.
  }
};

type AppearanceStore = {
  preference: AppearancePreference;
  setPreference: (preference: AppearancePreference) => void;
};

export const useAppearanceStore = create<AppearanceStore>((set) => ({
  preference: readStoredPreference(),
  setPreference: (preference) => {
    writeStoredPreference(preference);
    set({ preference });
  },
}));
