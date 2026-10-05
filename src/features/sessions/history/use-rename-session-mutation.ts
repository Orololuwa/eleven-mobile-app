import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import { renameSessionLocally } from '../tracking/db';
import { processOutboxes } from '../tracking/sync';
import { invalidateHistory } from './history-cache';

/** Renames on screen immediately; the outbox carries it to the server. `null` restores the derived title. */
export const useRenameSessionMutation = () =>
  useMutation({
    mutationFn: async ({ sessionId, title }: { sessionId: string; title: string | null }) => {
      const userId = useAppStore.getState().authUser?.id;
      if (!userId) throw new Error('You need to be signed in to rename a session.');
      await renameSessionLocally({ sessionId, userId, title });
    },
    onSuccess: () => {
      invalidateHistory();
      void processOutboxes();
    },
  });
