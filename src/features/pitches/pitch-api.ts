import { apiRequest } from '@/lib/api-client';
import type { PitchCorners, PitchCreate, PitchNearby, PitchRead } from './types';

export const fetchNearbyPitches = ({ lat, lng }: { lat: number; lng: number }) =>
  apiRequest<PitchNearby[]>({
    path: `/pitches/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
  });

export const checkSimilarPitches = (body: PitchCorners) =>
  apiRequest<PitchRead[]>({
    path: '/pitches/check-similar',
    method: 'POST',
    body,
  });

export const createPitch = (body: PitchCreate) =>
  apiRequest<PitchRead>({
    path: '/pitches',
    method: 'POST',
    body,
  });

export const fetchSavedPitches = () => apiRequest<PitchRead[]>({ path: '/pitches/saved' });

export const savePitch = (pitchId: string) =>
  apiRequest<PitchRead>({
    path: `/pitches/${pitchId}/save`,
    method: 'POST',
  });

export const unsavePitch = (pitchId: string) =>
  apiRequest<void>({
    path: `/pitches/${pitchId}/save`,
    method: 'DELETE',
  });
