import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Auth0Provider } from 'react-native-auth0';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { colors } from '@/theme';
import { config } from '@/lib/config';
import '@/features/sessions/tracking/location-task';

const AppStack = () => (
  <SafeAreaProvider>
    <QueryProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background.primary },
            animation: 'fade',
          }}
        />
      </AuthProvider>
    </QueryProvider>
  </SafeAreaProvider>
);

export default function RootLayout() {
  if (!config.auth0Domain || !config.auth0ClientId) {
    return <AppStack />;
  }

  return (
    <Auth0Provider domain={config.auth0Domain} clientId={config.auth0ClientId}>
      <AppStack />
    </Auth0Provider>
  );
}
