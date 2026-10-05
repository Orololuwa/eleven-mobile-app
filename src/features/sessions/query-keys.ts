import type { SessionType } from './types';

export const sessionQueryKey = {
  all: ['session'] as const,
  detail: (id: string) => ['session', id] as const,
};

type HistoryScope = { userId: string; sessionType: SessionType | null };

export const historyQueryKey = {
  all: ['session-history'] as const,
  list: ({ userId, sessionType }: HistoryScope) =>
    ['session-history', 'list', userId, sessionType ?? 'all'] as const,
  calendar: ({ userId, sessionType, month }: HistoryScope & { month: string }) =>
    ['session-history', 'calendar', userId, sessionType ?? 'all', month] as const,
  local: ({ userId, sessionType }: HistoryScope) =>
    ['session-history', 'local', userId, sessionType ?? 'all'] as const,
  detail: ({ userId, sessionId }: { userId: string; sessionId: string }) =>
    ['session-history', 'detail', userId, sessionId] as const,
};
