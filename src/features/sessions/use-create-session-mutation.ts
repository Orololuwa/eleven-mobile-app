import { useMutation } from '@tanstack/react-query';
import { createSession } from './session-api';

export const useCreateSessionMutation = () =>
  useMutation({
    mutationFn: createSession,
  });
