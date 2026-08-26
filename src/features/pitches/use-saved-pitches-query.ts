import { useQuery } from '@tanstack/react-query';
import { selectIsAuthenticated, useAppStore } from '@/stores/app-store';
import { fetchSavedPitches } from './pitch-api';
import { pitchQueryKey } from './query-keys';

export const useSavedPitchesQuery = () => {
  const isAuthenticated = useAppStore(selectIsAuthenticated);

  return useQuery({
    queryKey: pitchQueryKey.saved,
    queryFn: fetchSavedPitches,
    enabled: isAuthenticated,
  });
};
