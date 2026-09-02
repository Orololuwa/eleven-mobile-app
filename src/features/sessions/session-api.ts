import { apiRequest } from '@/lib/api-client';
import type { SessionCreate, SessionRead, SessionStartIn, SessionStartOut } from './types';
import type { SessionFinalizeBody, TrackPointsBody } from './tracking/types';

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

export const finalizeSession = ({
  sessionId,
  body,
}: {
  sessionId: string;
  body: SessionFinalizeBody;
}) =>
  apiRequest<void>({
    path: `/sessions/${sessionId}/finalize`,
    method: 'POST',
    body,
  });

export const uploadTrackPoints = ({
  sessionId,
  body,
}: {
  sessionId: string;
  body: TrackPointsBody;
}) =>
  apiRequest<void>({
    path: `/sessions/${sessionId}/track-points`,
    method: 'POST',
    body,
  });
