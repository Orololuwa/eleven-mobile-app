import { Alert, AppState, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as SecureStore from 'expo-secure-store';

type BackgroundPowerNative = {
  isIgnoringBatteryOptimizations: () => boolean;
  requestIgnoreBatteryOptimizations: () => Promise<boolean>;
};

const Native = requireOptionalNativeModule<BackgroundPowerNative>('TrackingIndicator');

/** Stock Doze dialog: asked once per install, and only while Android reports no exemption. */
const DOZE_PROMPTED_KEY = 'eleven.doze-exemption-prompted';

let promptInFlight: Promise<void> | null = null;

const ask = (title: string, message: string, allowLabel: string) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: allowLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

/**
 * Resolves once the user is back in the app after a settings screen. If the app never left (the
 * screen failed to open), resolves after a short grace instead of hanging kickoff.
 */
const whenBackInApp = () =>
  new Promise<void>((resolve) => {
    let left = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        left = true;
        return;
      }
      if (!left) return;
      sub.remove();
      resolve();
    });
    setTimeout(() => {
      if (left) return;
      sub.remove();
      resolve();
    }, 2_000);
  });

const safely = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const runPrompts = async () => {
  if (!Native) return;
  const needsDozeExemption = !safely(() => Native.isIgnoringBatteryOptimizations(), true);
  if (!needsDozeExemption || (await SecureStore.getItemAsync(DOZE_PROMPTED_KEY))) return;
  await SecureStore.setItemAsync(DOZE_PROMPTED_KEY, new Date().toISOString());
  const allow = await ask(
    'Keep tracking when locked',
    'Battery saving can cut Eleven’s GPS a few minutes after you lock your phone. Let Eleven run in the background so the whole session records.',
    'Allow',
  );
  if (allow && (await Native.requestIgnoreBatteryOptimizations())) {
    await whenBackInApp();
  }
};

/**
 * Android battery managers can stop session GPS a few minutes after lock even with the location
 * FGS running (Vivo PEM freezes the app and removes its GPS request — 20 Oct 2026 repro). Being on
 * the Doze whitelist stopped the freeze in the 21 Oct repro. Vivo's own background-power screen
 * does not list the app, so it is not offered. Runs
 * before kickoff so the session clock does not start while the user is in Settings; resolves once
 * they are back in the app. Never throws.
 */
export const promptBackgroundPowerIfNeeded = async () => {
  if (Platform.OS !== 'android' || !Native) return;
  if (!promptInFlight) {
    promptInFlight = runPrompts()
      .catch((error) => {
        console.warn('[background-power] prompt failed', error);
      })
      .finally(() => {
        promptInFlight = null;
      });
  }
  await promptInFlight;
};
