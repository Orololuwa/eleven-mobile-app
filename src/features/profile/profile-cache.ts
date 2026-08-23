import type { QueryClient } from '@tanstack/react-query';
import { fetchMyProfile } from './profile-api';
import { profileQueryKey } from './query-keys';

export const prefetchMyProfile = async (queryClient: QueryClient) => {
  const profile = await fetchMyProfile();
  queryClient.setQueryData(profileQueryKey.me, profile);
  return profile;
};

export const clearProfileCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: profileQueryKey.all });
};
