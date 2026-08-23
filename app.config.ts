import type { ConfigContext, ExpoConfig } from 'expo/config';

const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Eleven',
  slug: config.slug ?? 'eleven-app',
  plugins: [
    'expo-location',
    [
      'expo-image-picker',
      {
        photosPermission: 'Eleven uses your photo library to set your profile avatar.',
        cameraPermission: 'Eleven uses your camera to take a profile avatar photo.',
      },
    ],
    'expo-router',
    'expo-secure-store',
    'expo-dev-client',
    '@react-native-community/datetimepicker',
    [
      'react-native-auth0',
      {
        domain: auth0Domain,
        customScheme: 'eleven',
      },
    ],
  ],
});
