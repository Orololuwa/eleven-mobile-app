import { useQuery } from '@tanstack/react-query';
import { selectIsAuthenticated, useAppStore } from '@/stores/app-store';
import { fetchNearbyPitches } from './pitch-api';
import { pitchQueryKey } from './query-keys';

export const useNearbyPitchesQuery = ({ lat, lng }: { lat: number | null; lng: number | null }) => {
  const isAuthenticated = useAppStore(selectIsAuthenticated);
  const hasCoords = lat != null && lng != null;

  return useQuery({
    queryKey: pitchQueryKey.nearby({ lat: lat ?? 0, lng: lng ?? 0 }),
    queryFn: () => fetchNearbyPitches({ lat: lat!, lng: lng! }),
    enabled: isAuthenticated && hasCoords,
  });
};
