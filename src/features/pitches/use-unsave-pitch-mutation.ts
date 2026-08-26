import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unsavePitch } from './pitch-api';
import { pitchQueryKey } from './query-keys';
import type { PitchRead } from './types';

export const useUnsavePitchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pitchId: string) => unsavePitch(pitchId),
    onSuccess: (_data, pitchId) => {
      queryClient.setQueryData<PitchRead[]>(pitchQueryKey.saved, (previous) =>
        previous?.filter((pitch) => pitch.id !== pitchId),
      );
    },
  });
};
