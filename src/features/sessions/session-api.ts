import { apiRequest } from '@/lib/api-client';
import type { SessionCreate, SessionRead, SessionStartIn, SessionStartOut } from './types';
import type { SessionFinalizeBody, TrackPointsBody } from './tracking/types';

export const createSession = (body: SessionCreate) =>
  apiRequest<SessionRead>({
    path: '/sessions',
    method: 'POST',
    body,
  });

/**
 * Backend returns a flat `SessionRead` with nested `segments`.
 * Normalize to `{ session, segments }` for local tracking seed.
 */
export const startSession = async ({
  sessionId,
  body,
}: {
  sessionId: string;
  body?: SessionStartIn;
}): Promise<SessionStartOut> => {
  const payload = await apiRequest<SessionRead | SessionStartOut>({
    path: `/sessions/${sessionId}/start`,
    method: 'POST',
    body: body ?? {},
  });

  if (payload && typeof payload === 'object' && 'session' in payload && payload.session) {
    const wrapped = payload as SessionStartOut;
    return {
      session: wrapped.session,
      segments: wrapped.segments ?? [],
    };
  }

  const read = payload as SessionRead;
  return {
    session: read,
    segments: read.segments ?? [],
  };
};

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
