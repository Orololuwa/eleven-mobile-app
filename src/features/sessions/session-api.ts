import { apiRequest } from '@/lib/api-client';
import type { SessionCreate, SessionRead, SessionStartIn, SessionStartOut } from './types';

export const createSession = (body: SessionCreate) =>
  apiRequest<SessionRead>({
    path: '/sessions',
    method: 'POST',
    body,
  });

export const startSession = ({ sessionId, body }: { sessionId: string; body?: SessionStartIn }) =>
  apiRequest<SessionStartOut>({
    path: `/sessions/${sessionId}/start`,
    method: 'POST',
    body: body ?? {},
  });
