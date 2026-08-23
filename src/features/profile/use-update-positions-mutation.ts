import { useMutation, useQueryClient } from '@tanstack/react-query';
import { replaceMyPositions } from './profile-api';
import { profileQueryKey } from './query-keys';
import type { ProfileRead } from './types';

export const useUpdatePositionsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceMyPositions,
    onSuccess: (positions) => {
      queryClient.setQueryData<ProfileRead>(profileQueryKey.me, (current) =>
        current ? { ...current, positions } : current,
      );
    },
  });
};
