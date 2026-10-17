export type SessionTeardownProbe = {
  tracking_status: string;
  ended_at: string | null;
} | null;

export type TeardownAction = 'process' | 'stop' | 'skip';

/**
 * Decides whether a delivered fix should be processed, skipped, or tear down location updates.
 *
 * - Explicit end (`ended` / `ended_at`) always stops.
 * - A null session while tracking is still **desired** must never unsubscribe mid-run — orphaned
 *   FGS until the user ends is better than a silent dropout (Amendment 02 B0.1).
 * - A null session after tracking is **not** desired (user ended / stop already called) must stop
 *   so leftover watch/task callbacks do not flood the JS thread.
 */
export const nextTeardownAction = ({
  session,
  previousNullCount,
  trackingDesired = true,
}: {
  session: SessionTeardownProbe;
  previousNullCount: number;
  /** False once stop/end has been requested — leftover deliveries should tear down, not skip forever. */
  trackingDesired?: boolean;
}): { nullCount: number; action: TeardownAction; reason: string } => {
  if (!session) {
    if (!trackingDesired) {
      return { nullCount: 0, action: 'stop', reason: 'tracking-off' };
    }
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
