const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '';

/** @param {{ config: import('expo/config').ExpoConfig }} ctx */
module.exports = ({ config }) => ({
  ...config,
  name: config.name ?? 'Eleven',
  slug: config.slug ?? 'eleven-app',
  owner: 'orololuwa',
  extra: {
    ...config.extra,
    eas: {
      projectId: '5a813834-3842-4946-b721-3c6add708755',
    },
  },
  android: {
    ...config.android,
    permissions: [
      ...new Set([
        ...(config.android?.permissions ?? []),
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
      ]),
    ],
  },
  plugins: [
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Eleven uses your location to mark pitch corners and suggest nearby grounds.',
        locationAlwaysAndWhenInUsePermission:
          'Eleven needs to track your session even while your phone is locked in your pocket.',
        isIosBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
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
    'expo-sqlite',
    'expo-task-manager',
    'expo-live-activity',
    '@react-native-community/datetimepicker',
    [
      'react-native-auth0',
      {
        domain: auth0Domain,
        customScheme: 'eleven',
      },
    ],
    './plugins/with-safe-react-delegate.js',
    './plugins/with-speed-accuracy.js',
  ],
});
