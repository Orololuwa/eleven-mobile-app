export type AuthIdentity = {
  provider: string;
  auth0_sub: string;
  created_at: string;
};

export type AuthUser = {
  id: string;
  email: string | null;
  email_verified: boolean;
  identities: AuthIdentity[];
  created_at: string;
  updated_at: string;
};

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
