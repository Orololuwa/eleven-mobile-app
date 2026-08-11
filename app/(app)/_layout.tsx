import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pitch-setup" />
      <Stack.Screen name="active-session" />
      <Stack.Screen name="session-summary" />
      <Stack.Screen name="session/[id]" />
      <Stack.Screen name="player-details" />
      <Stack.Screen name="sign-in-methods" />
      <Stack.Screen name="units" />
      <Stack.Screen name="saved-pitches" />
      <Stack.Screen name="privacy-data" />
      <Stack.Screen name="link-conflict" />
      <Stack.Screen
        name="find-wall"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
