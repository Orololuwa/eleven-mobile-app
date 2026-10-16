import { toComputationInput } from '../summary/computation-input';
import {
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getTrackingSession,
} from './db';
import { computeLiveReadout } from './live-metrics';
import { getLatestFix } from './location-task';
import type { LiveMetrics } from './types';

const SUPPRESSED: LiveMetrics = { distanceKm: null, topSpeedKmh: null, signal: 'settling' };

/** Live readout for `segmentId` (session totals when null), classified over the session so far. */
export const readLiveReadout = async ({
  sessionId,
  segmentId = null,
}: {
  sessionId: string;
  segmentId?: string | null;
}): Promise<LiveMetrics> => {
  const [session, segments, pauses, points] = await Promise.all([
    getTrackingSession(sessionId),
    getSegmentsForSession(sessionId),
    getPausesForSession(sessionId),
    getPointsForSession(sessionId),
  ]);
  if (!session) return SUPPRESSED;

  const now = new Date().toISOString();
  return computeLiveReadout({
    input: toComputationInput({
      session,
      segments,
      pauses,
      points,
      openEndsAt: now,
      computedAt: now,
    }),
    segmentId,
    latestFix: getLatestFix(),
  });
};
