import { getAuth0 } from './auth0-client';
import type { Credentials } from './auth0-client';

export const saveCredentials = (credentials: Credentials) =>
  getAuth0().credentialsManager.saveCredentials(credentials);

export const clearStoredCredentials = async () => {
  try {
    await getAuth0().credentialsManager.clearCredentials();
  } catch {
    // Nothing stored, or native store already empty.
  }
};

export const hasStoredCredentials = async () => {
  try {
    return await getAuth0().credentialsManager.hasValidCredentials();
  } catch {
    return false;
  }
};

export const getStoredCredentials = async ({
  forceRefresh = false,
}: {
  forceRefresh?: boolean;
} = {}) => {
  try {
    return await getAuth0().credentialsManager.getCredentials(
      undefined,
      60,
      undefined,
      forceRefresh,
    );
  } catch {
    return null;
  }
};

export const getAccessToken = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
  const credentials = await getStoredCredentials({ forceRefresh });
  return credentials?.accessToken ?? null;
};
