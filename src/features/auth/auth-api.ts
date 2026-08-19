import { apiRequest } from '@/lib/api-client';
import type { AuthUser } from './types';

export const fetchMe = () => apiRequest<AuthUser>({ path: '/me' });

export const linkIdentity = ({ secondaryToken }: { secondaryToken: string }) =>
  apiRequest<AuthUser>({
    path: '/me/link',
    method: 'POST',
    body: { secondary_token: secondaryToken },
  });
