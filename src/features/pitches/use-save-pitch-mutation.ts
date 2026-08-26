import { useMutation, useQueryClient } from '@tanstack/react-query';
import { savePitch } from './pitch-api';
import { pitchQueryKey } from './query-keys';

export const useSavePitchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pitchId: string) => savePitch(pitchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pitchQueryKey.saved });
    },
  });
};
