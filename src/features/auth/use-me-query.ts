import { useQuery } from '@tanstack/react-query';
import { selectIsAuthenticated, useAppStore } from '@/stores/app-store';
import { fetchMe } from './auth-api';
import { meQueryKey } from './query-keys';

export const useMeQuery = () => {
  const isAuthenticated = useAppStore(selectIsAuthenticated);

  return useQuery({
    queryKey: meQueryKey,
    queryFn: fetchMe,
    enabled: isAuthenticated,
  });
};
