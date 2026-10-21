import {
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getTrackingSession,
} from '../tracking/db';
import { toComputationInput } from './computation-input';
import { computeSessionMetrics, dopplerReferenceDistanceM } from './compute-session-metrics';
import { METRICS_COMPARISON_ENABLED } from './constants';
import { saveComputedMetrics, saveMetricsComparison } from './metrics-store';
import type { ComputationInput, ComputedSessionMetrics } from './types';

/**
 * Amendment 03 §4: the first v3 sessions produce a comparison, not just a replacement. v2, the live
 * forward pass and the Doppler integral are computed over the same trace and kept on the phone.
 */
const recordComparison = async ({
  sessionId,
  input,
  stored,
}: {
  sessionId: string;
  input: ComputationInput;
  stored: ComputedSessionMetrics;
}) => {
  const v2 = computeSessionMetrics(input, { algorithm: 'v2' });
  const live = computeSessionMetrics(input, { smooth: false });
  const doppler = dopplerReferenceDistanceM(input);
  await saveMetricsComparison({
    sessionId,
    computedAt: stored.computedAt,
    storedVersion: stored.algorithmVersion,
    v3DistanceM: stored.distanceM,
    v3LiveDistanceM: live.distanceM,
    v2DistanceM: v2.distanceM,
    dopplerDistanceM: doppler,
    v3TopSpeedKmh: stored.topSpeedKmh,
    v2TopSpeedKmh: v2.topSpeedKmh,
    v3DataQuality: stored.dataQuality,
    v2DataQuality: v2.dataQuality,
    v3AcceptedFixCount: stored.acceptedFixCount,
    v2AcceptedFixCount: v2.acceptedFixCount,
  });
  console.log('[metrics] v3 vs v2', {
    sessionId,
    v3DistanceM: Math.round(stored.distanceM),
    v3LiveDistanceM: Math.round(live.distanceM),
    v2DistanceM: Math.round(v2.distanceM),
    dopplerDistanceM: Math.round(doppler),
    v3TopSpeedKmh: stored.topSpeedKmh,
    v2TopSpeedKmh: v2.topSpeedKmh,
    v3DataQuality: stored.dataQuality,
    v2DataQuality: v2.dataQuality,
  });
};

export const computeAndStoreSessionMetrics = async ({
  sessionId,
  massKg,
}: {
  sessionId: string;
  massKg: number | null;
}) => {
  const session = await getTrackingSession(sessionId);
  if (!session?.ended_at) return;

  const [segments, pauses, points] = await Promise.all([
    getSegmentsForSession(sessionId),
    getPausesForSession(sessionId),
    getPointsForSession(sessionId),
  ]);

  const input = toComputationInput({
    session,
    segments,
    pauses,
    points,
    massKg,
    computedAt: session.ended_at,
  });
  const computed = computeSessionMetrics(input);

  await saveComputedMetrics({ sessionId, computed });

  if (METRICS_COMPARISON_ENABLED) {
    // Diagnostics only — never let it fail the stored result.
    try {
      await recordComparison({ sessionId, input, stored: computed });
    } catch (error) {
      console.warn('[metrics] comparison failed', error);
    }
  }
};
