export const profileQueryKey = {
  all: ['profile'] as const,
  me: ['profile', 'me'] as const,
  byUser: (userId: string) => ['profile', userId] as const,
};
