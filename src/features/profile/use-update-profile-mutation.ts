import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { updateMyProfile } from './profile-api';
import { profileQueryKey } from './query-keys';

export const useUpdateProfileMutation = () => {
  const queryClient = useQueryClient();
  const setOnboardingCompleted = useAppStore((state) => state.setOnboardingCompleted);

  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey.me, profile);
      setOnboardingCompleted(profile.onboarding_completed);
    },
  });
};
