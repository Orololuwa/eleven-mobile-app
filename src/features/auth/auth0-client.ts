import Auth0, { type Credentials } from 'react-native-auth0';
import { AUTH0_SCHEME, AUTH_SCOPE, assertAuthConfig, config } from '@/lib/config';
import type { SignInMethodId } from '@/types/profile';

let client: Auth0 | null = null;

export const getAuth0 = () => {
  assertAuthConfig();
  if (!client) {
    client = new Auth0({
      domain: config.auth0Domain,
      clientId: config.auth0ClientId,
    });
  }
  return client;
};

const connectionFor = (provider: SignInMethodId) =>
  provider === 'google' ? 'google-oauth2' : provider === 'apple' ? 'apple' : 'email';

const authorizeOptions = ({ ephemeralSession = false }: { ephemeralSession?: boolean } = {}) => ({
  customScheme: AUTH0_SCHEME,
  ephemeralSession,
});

const authorizeParams = (connection?: string) => ({
  audience: config.auth0Audience,
  scope: AUTH_SCOPE,
  ...(connection ? { connection } : {}),
});

export const authorizeConnection = ({
  provider,
  ephemeralSession = false,
}: {
  provider: Exclude<SignInMethodId, 'email'>;
  ephemeralSession?: boolean;
}) =>
  getAuth0().webAuth.authorize(
    authorizeParams(connectionFor(provider)),
    authorizeOptions({ ephemeralSession }),
  );

export const sendEmailCode = ({ email }: { email: string }) =>
  getAuth0().auth.passwordlessWithEmail({
    email,
    send: 'code',
    authParams: {
      audience: config.auth0Audience,
      scope: AUTH_SCOPE,
    },
  });

export const loginWithEmailCode = ({ email, code }: { email: string; code: string }) =>
  getAuth0().auth.loginWithEmail({
    email,
    code,
    audience: config.auth0Audience,
    scope: AUTH_SCOPE,
  });

export const clearAuth0Session = async () => {
  try {
    await getAuth0().webAuth.clearSession({}, authorizeOptions());
  } catch {
    // Local sign-out still proceeds if the browser logout is cancelled or fails.
  }
};

export type { Credentials };
