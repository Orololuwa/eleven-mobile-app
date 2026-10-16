import { LOCATION_FIX_STALE_MS } from './constants';

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
