import type { QueryClient } from '@tanstack/react-query';
import { historyQueryKey } from '../query-keys';

let queryClient: QueryClient | null = null;

/** Lets non-React code (sync worker, outboxes, sign-out) refresh or drop history queries. */
export const bindHistoryQueryClient = (client: QueryClient) => {
  queryClient = client;
};

export const invalidateHistory = () => {
  void queryClient?.invalidateQueries({ queryKey: historyQueryKey.all });
};

export const clearHistoryCache = () => {
  queryClient?.removeQueries({ queryKey: historyQueryKey.all });
};
