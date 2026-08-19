import type { QueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import type { ProfileData, SignInMethodId } from '@/types/profile';
import { fetchMe, linkIdentity } from './auth-api';
import {
  authorizeConnection,
  clearAuth0Session,
  loginWithEmailCode,
  sendEmailCode,
  type Credentials,
} from './auth0-client';
import { loadLocalProfile, saveLocalProfile } from './local-profile';
import { meQueryKey } from './query-keys';
import {
  clearStoredCredentials,
  getAccessToken,
  getStoredCredentials,
  hasStoredCredentials,
  saveCredentials,
} from './token-storage';

let queryClient: QueryClient | null = null;
let signingOut = false;

export const bindAuthQueryClient = (client: QueryClient) => {
  queryClient = client;
};

const syncMeCache = (user: ReturnType<typeof useAppStore.getState>['authUser']) => {
  if (user) queryClient?.setQueryData(meQueryKey, user);
  else queryClient?.removeQueries({ queryKey: meQueryKey });
};

const applyAuthenticated = async ({
  credentials,
  showEmptyWallBanner = false,
}: {
  credentials: Credentials;
  showEmptyWallBanner?: boolean;
}) => {
  await saveCredentials(credentials);
  const authUser = await fetchMe();
  const user = await loadLocalProfile(authUser.id);
  useAppStore.getState().applySession({ authUser, user });
  useAppStore.getState().setShowEmptyWallBanner(showEmptyWallBanner);
  syncMeCache(authUser);
  return { authUser, user };
};

const attachSecondaryIdentity = async ({
  stored,
  secondaryToken,
}: {
  stored: Credentials;
  secondaryToken: string;
}) => {
  await saveCredentials(stored);

  try {
    const authUser = await linkIdentity({ secondaryToken });
    useAppStore.getState().applyAuthUser(authUser);
    syncMeCache(authUser);
    return authUser;
  } catch (error) {
    await saveCredentials(stored);
    throw error;
  }
};

export const linkProvider = async (provider: Exclude<SignInMethodId, 'email'>) => {
  const stored = await getStoredCredentials();
  if (!stored) throw new Error('You need to be signed in to add a method.');

  const secondary = await authorizeConnection({ provider, ephemeralSession: true });
  return attachSecondaryIdentity({ stored, secondaryToken: secondary.accessToken });
};

export const linkEmailIdentity = async ({ email, code }: { email: string; code: string }) => {
  const stored = await getStoredCredentials();
  if (!stored) throw new Error('You need to be signed in to add a method.');

  const secondary = await loginWithEmailCode({ email, code });
  return attachSecondaryIdentity({ stored, secondaryToken: secondary.accessToken });
};

export const hydrateSession = async () => {
  const store = useAppStore.getState();
  store.setAuthStatus('loading');

  try {
    const hasCredentials = await hasStoredCredentials();
    if (!hasCredentials) {
      store.resetAuth();
      syncMeCache(null);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      await clearStoredCredentials();
      store.resetAuth();
      syncMeCache(null);
      return;
    }

    const authUser = await fetchMe();
    const user = await loadLocalProfile(authUser.id);
    store.applySession({ authUser, user });
    syncMeCache(authUser);
  } catch {
    await clearStoredCredentials();
    store.resetAuth();
    syncMeCache(null);
  }
};

export const signInWithGoogle = () =>
  authorizeConnection({ provider: 'google' }).then((credentials) =>
    applyAuthenticated({ credentials, showEmptyWallBanner: false }),
  );

export const signInWithApple = () =>
  authorizeConnection({ provider: 'apple' }).then((credentials) =>
    applyAuthenticated({ credentials, showEmptyWallBanner: true }),
  );

export const requestEmailCode = ({ email }: { email: string }) => sendEmailCode({ email });

export const verifyEmailCode = ({ email, code }: { email: string; code: string }) =>
  loginWithEmailCode({ email, code }).then((credentials) =>
    applyAuthenticated({ credentials, showEmptyWallBanner: false }),
  );

export const completeLocalOnboarding = async (profile: ProfileData) => {
  const { authUser, completeOnboarding } = useAppStore.getState();
  const next = { ...profile, fullName: profile.fullName || profile.firstName };
  completeOnboarding(next);
  if (authUser) await saveLocalProfile(authUser.id, next);
};

export const signOut = async () => {
  if (signingOut) return;
  signingOut = true;
  try {
    await clearAuth0Session();
    await clearStoredCredentials();
    useAppStore.getState().resetAuth();
    syncMeCache(null);
  } finally {
    signingOut = false;
  }
};

export const clearLocalSession = async () => {
  await clearStoredCredentials();
  useAppStore.getState().resetAuth();
  syncMeCache(null);
};

export const useAuthActions = () => ({
  signInWithGoogle,
  signInWithApple,
  requestEmailCode,
  verifyEmailCode,
  linkProvider,
  linkEmailIdentity,
  signOut,
  hydrateSession,
  completeLocalOnboarding,
});
