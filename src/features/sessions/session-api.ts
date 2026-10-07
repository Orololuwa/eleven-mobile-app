import { apiRequest } from '@/lib/api-client';
import type {
  SessionCalendar,
  SessionCreate,
  SessionDetail,
  SessionListPage,
  SessionRead,
  SessionStartIn,
  SessionStartOut,
  SessionType,
  WeeklySessionWindow,
} from './types';
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

const toQuery = (params: Record<string, string | number | null | undefined>) => {
  const pairs = Object.entries(params).flatMap(([key, value]) =>
    value == null ? [] : [`${key}=${encodeURIComponent(String(value))}`],
  );
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
};

export const HISTORY_PAGE_SIZE = 20;

export const fetchSessionHistoryPage = ({
  sessionType = null,
  cursor = null,
  limit = HISTORY_PAGE_SIZE,
}: {
  sessionType?: SessionType | null;
  cursor?: string | null;
  limit?: number;
} = {}) =>
  apiRequest<SessionListPage>({
    path: `/sessions${toQuery({ session_type: sessionType, cursor, limit })}`,
  });

export const fetchSessionCalendar = ({
  month,
  tz,
  sessionType = null,
}: {
  month: string;
  tz: string;
  sessionType?: SessionType | null;
}) =>
  apiRequest<SessionCalendar>({
    path: `/sessions/calendar${toQuery({ month, tz, session_type: sessionType })}`,
  });

/** Ended sessions with `started_at` in `[start, end)`; the span must be at most 15 days. */
export const fetchWeeklySessions = ({ start, end }: { start: Date; end: Date }) =>
  apiRequest<WeeklySessionWindow>({
    path: `/sessions/weekly${toQuery({ start: start.toISOString(), end: end.toISOString() })}`,
  });

export const fetchSessionDetail = (sessionId: string) =>
  apiRequest<SessionDetail>({ path: `/sessions/${sessionId}` });

export const renameSessionRemote = ({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string | null;
}) =>
  apiRequest<{ id: string; title: string | null }>({
    path: `/sessions/${sessionId}`,
    method: 'PATCH',
    body: { title },
  });

export const deleteSessionRemote = (sessionId: string) =>
  apiRequest<void>({ path: `/sessions/${sessionId}`, method: 'DELETE' });

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
