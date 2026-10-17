/**
 * Recovery policy for location registration (Amendment 02 B0.1).
 * Pure helpers so lock-safe renew can be unit-tested without TaskManager.
 */

export type RecoveryStartReason = 'start' | 'watchdog' | 'foreground' | 'app-state';

/** Only the initial HUD kickoff may wait for AppState active inside the start lock. */
export const shouldWaitForAppActive = (reason: RecoveryStartReason | string) => reason === 'start';

/**
 * Expo can report the location task as still started after GMS has dropped the fused
 * registration. A stale fix feed means we must renew even when `running` is true.
 */
export const needsForcedRenew = ({
  running,
  feedStale,
}: {
  running: boolean;
  feedStale: boolean;
}) => !running || feedStale;
