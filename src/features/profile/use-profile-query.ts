import { useQuery } from '@tanstack/react-query';
import { selectIsAuthenticated, useAppStore } from '@/stores/app-store';
import { fetchMyProfile, fetchProfileByUserId } from './profile-api';
import { profileQueryKey } from './query-keys';
import type { ProfileRead, ProfileReadPublic } from './types';

export const useMyProfileQuery = () => {
  const isAuthenticated = useAppStore(selectIsAuthenticated);

  return useQuery({
    queryKey: profileQueryKey.me,
    queryFn: fetchMyProfile,
    enabled: isAuthenticated,
  });
};

export const useProfileQuery = ({ userId }: { userId: string }) => {
  const isAuthenticated = useAppStore(selectIsAuthenticated);

  return useQuery<ProfileRead | ProfileReadPublic>({
    queryKey: profileQueryKey.byUser(userId),
    queryFn: () => fetchProfileByUserId(userId),
    enabled: isAuthenticated && Boolean(userId),
  });
};
