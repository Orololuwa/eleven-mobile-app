import { useMutation } from '@tanstack/react-query';
import { startSession } from './session-api';
import type { SessionStartIn } from './types';

export const useStartSessionMutation = () =>
  useMutation({
    mutationFn: ({ sessionId, body }: { sessionId: string; body?: SessionStartIn }) =>
      startSession({ sessionId, body }),
  });
