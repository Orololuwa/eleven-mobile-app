import { useMutation } from '@tanstack/react-query';
import { checkSimilarPitches } from './pitch-api';

export const useCheckSimilarPitches = () =>
  useMutation({
    mutationFn: checkSimilarPitches,
  });
