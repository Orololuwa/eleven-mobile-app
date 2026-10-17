export type SessionTeardownProbe = {
  tracking_status: string;
  ended_at: string | null;
} | null;

export type TeardownAction = 'process' | 'stop' | 'skip';

/**
 * Decides whether a delivered fix should be processed, skipped, or tear down location updates.
 * Explicit end always stops. A null session read must never unsubscribe mid-run — orphaned FGS
 * until the user ends the session is better than a silent dropout (Amendment 02 B0.1).
 */
export const nextTeardownAction = ({
  session,
  previousNullCount,
}: {
  session: SessionTeardownProbe;
  previousNullCount: number;
}): { nullCount: number; action: TeardownAction; reason: string } => {
  if (!session) {
    return {
      nullCount: previousNullCount + 1,
      action: 'skip',
      reason: 'null-session',
    };
  }

  if (session.tracking_status === 'ended' || session.ended_at) {
    return { nullCount: 0, action: 'stop', reason: 'ended' };
  }

  return { nullCount: 0, action: 'process', reason: 'live' };
};
