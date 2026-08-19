import React, { useEffect } from 'react';
import { configureApiClient } from '@/lib/api-client';
import {
  bindAuthQueryClient,
  clearLocalSession,
  hydrateSession,
} from '@/features/auth/use-auth-actions';
import { getAccessToken } from '@/features/auth/token-storage';
import { useQueryClient } from '@tanstack/react-query';

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    bindAuthQueryClient(queryClient);
    configureApiClient({
      getAccessToken,
      onUnauthorized: () => {
        void clearLocalSession();
      },
    });
    void hydrateSession();
  }, [queryClient]);

  return <>{children}</>;
};
