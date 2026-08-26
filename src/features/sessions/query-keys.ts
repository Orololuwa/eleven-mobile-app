export const sessionQueryKey = {
  all: ['session'] as const,
  detail: (id: string) => ['session', id] as const,
};
