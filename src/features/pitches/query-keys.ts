export const pitchQueryKey = {
  all: ['pitch'] as const,
  saved: ['pitch', 'saved'] as const,
  nearby: ({ lat, lng }: { lat: number; lng: number }) => ['pitch', 'nearby', lat, lng] as const,
};
