import { useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/stores/app-store';
import type { SessionType } from '../types';
import { deleteSessionLocally } from '../tracking/db';
import { forgetSessionSync, processOutboxes } from '../tracking/sync';
import { invalidateHistory } from './history-cache';

/** Removes the session from this device at once; the outbox deletes the server copy. */
export const useDeleteSessionMutation = () =>
  useMutation({
    mutationFn: async ({
      sessionId,
      sessionType,
    }: {
      sessionId: string;
      sessionType: SessionType;
    }) => {
      const userId = useAppStore.getState().authUser?.id;
      if (!userId) throw new Error('You need to be signed in to delete a session.');
      forgetSessionSync(sessionId);
      await deleteSessionLocally({ sessionId, userId, sessionType });
    },
    onSuccess: () => {
      invalidateHistory();
      void processOutboxes();
    },
  });
