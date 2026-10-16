import { LOCATION_NULL_SESSION_STOP_AFTER } from './constants';

export type SessionTeardownProbe = {
  tracking_status: string;
  ended_at: string | null;
} | null;

export type TeardownAction = 'process' | 'stop' | 'skip';

/**
 * Decides whether a delivered fix should be processed, skipped, or tear down location updates.
 * Explicit end always stops. A single null session read must not — only repeated confirmation.
 */
export const nextTeardownAction = ({
  session,
  previousNullCount,
  nullStopAfter = LOCATION_NULL_SESSION_STOP_AFTER,
}: {
  session: SessionTeardownProbe;
  previousNullCount: number;
  nullStopAfter?: number;
}): { nullCount: number; action: TeardownAction; reason: string } => {
  if (!session) {
    const nullCount = previousNullCount + 1;
    if (nullCount >= nullStopAfter) {
      return { nullCount, action: 'stop', reason: 'null-session-confirmed' };
    }
    return { nullCount, action: 'skip', reason: 'null-session' };
  }

  if (session.tracking_status === 'ended' || session.ended_at) {
    return { nullCount: 0, action: 'stop', reason: 'ended' };
  }

  return { nullCount: 0, action: 'process', reason: 'live' };
};
