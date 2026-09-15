const trimEnv = (value?: string) => value?.trim() ?? '';

export const AUTH_SCOPE = 'openid profile email offline_access';
export const AUTH0_SCHEME = 'eleven';

export const config = {
  apiUrl: (trimEnv(process.env.EXPO_PUBLIC_API_URL) || 'http://localhost:8000').replace(/\/$/, ''),
  auth0Domain: trimEnv(process.env.EXPO_PUBLIC_AUTH0_DOMAIN),
  auth0ClientId: trimEnv(process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID),
  auth0Audience: trimEnv(process.env.EXPO_PUBLIC_AUTH0_AUDIENCE),
};

export const assertAuthConfig = () => {
  if (!config.auth0Domain || !config.auth0ClientId || !config.auth0Audience) {
    throw new Error(
      'Auth0 is not configured. Set EXPO_PUBLIC_AUTH0_DOMAIN, EXPO_PUBLIC_AUTH0_CLIENT_ID, and EXPO_PUBLIC_AUTH0_AUDIENCE in .env.',
    );
  }
};
