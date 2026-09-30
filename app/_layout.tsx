import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Auth0Provider } from 'react-native-auth0';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { useColors, useResolvedColorScheme } from '@/theme';
import { config } from '@/lib/config';
import '@/features/sessions/tracking/location-task';

const AppStack = () => {
  const colors = useColors();
  const scheme = useResolvedColorScheme();

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
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
};

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
