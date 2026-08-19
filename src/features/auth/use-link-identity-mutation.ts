import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { linkIdentity } from './auth-api';
import { meQueryKey } from './query-keys';

export const useLinkIdentityMutation = () => {
  const queryClient = useQueryClient();
  const applyAuthUser = useAppStore((state) => state.applyAuthUser);

  return useMutation({
    mutationFn: linkIdentity,
    onSuccess: (user) => {
      queryClient.setQueryData(meQueryKey, user);
      applyAuthUser(user);
    },
  });
};
