import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAvatar } from './profile-api';
import { profileQueryKey } from './query-keys';
import type { ProfileRead } from './types';

export const useDeleteAvatarMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      queryClient.setQueryData<ProfileRead>(profileQueryKey.me, (current) =>
        current
          ? {
              ...current,
              avatar_public_id: null,
              avatar_url: null,
              avatar_updated_at: null,
            }
          : current,
      );
    },
  });
};
