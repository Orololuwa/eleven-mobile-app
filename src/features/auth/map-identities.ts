import type { SignInMethod, SignInMethodId } from '@/types/profile';
import type { AuthIdentity, AuthUser } from './types';

const METHOD_META: Record<SignInMethodId, { id: SignInMethodId; label: string }> = {
  google: { id: 'google', label: 'Google' },
  email: { id: 'email', label: 'Email Code' },
  apple: { id: 'apple', label: 'Apple' },
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const formatSince = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]}`;
};

const asProvider = (value: string): SignInMethodId | null =>
  value === 'google' || value === 'email' || value === 'apple' ? value : null;

export const emptySignInMethods = (): SignInMethod[] =>
  (['google', 'email', 'apple'] as const).map((id) => ({
    ...METHOD_META[id],
    connected: false,
  }));

export const methodsFromUser = (user: AuthUser): SignInMethod[] => {
  const byProvider = new Map(
    user.identities
      .map((identity: AuthIdentity) => {
        const provider = asProvider(identity.provider);
        return provider ? ([provider, identity] as const) : null;
      })
      .filter((entry): entry is readonly [SignInMethodId, AuthIdentity] => entry !== null),
  );

  return (['google', 'email', 'apple'] as const).map((id) => {
    const identity = byProvider.get(id);
    return {
      ...METHOD_META[id],
      connected: Boolean(identity),
      email: identity ? (user.email ?? undefined) : undefined,
      since: identity ? formatSince(identity.created_at) : undefined,
    };
  });
};
