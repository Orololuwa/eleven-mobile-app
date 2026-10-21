import { LOCATION_FIX_STALE_MS, WATCH_YIELDS_TO_TASK_MS } from './constants';

/** True when no fix has arrived recently — the app is not receiving, not merely poor quality. */
export const isFixFeedStale = ({
  fix,
  nowMs = Date.now(),
  staleMs = LOCATION_FIX_STALE_MS,
}: {
  fix: { accuracyM: number | null; atMs: number } | null;
  nowMs?: number;
  staleMs?: number;
}) => !fix || nowMs - fix.atMs > staleMs;

/** True when a foreground-watch fix should be ignored because the direct GPS task is live. */
export const watchShouldYieldToTask = ({
  lastTaskDeliveryAtMs,
  nowMs = Date.now(),
  yieldMs = WATCH_YIELDS_TO_TASK_MS,
}: {
  lastTaskDeliveryAtMs: number | null;
  nowMs?: number;
  yieldMs?: number;
}) => lastTaskDeliveryAtMs != null && nowMs - lastTaskDeliveryAtMs <= yieldMs;
