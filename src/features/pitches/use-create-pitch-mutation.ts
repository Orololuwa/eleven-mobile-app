import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPitch } from './pitch-api';
import { pitchQueryKey } from './query-keys';

export const useCreatePitchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPitch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pitchQueryKey.saved });
    },
  });
};
