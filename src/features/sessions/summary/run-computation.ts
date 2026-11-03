import {
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getTrackingSession,
} from '../tracking/db';
import { toComputationInput } from './computation-input';
import {
  computeSessionMetrics,
  dopplerReferenceDistanceM,
  stepImpliedDistanceM,
} from './compute-session-metrics';
import { METRICS_COMPARISON_ENABLED, STEP_CROSSCHECK_MAX_DIVERGENCE } from './constants';
import { saveComputedMetrics, saveMetricsComparison } from './metrics-store';
import { DEFAULT_STRIDE } from './steps';
import { clearStrideSamples, getStrideEstimate, saveStrideSamples } from './stride-store';
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
  const noSensors = computeSessionMetrics(input, { sensors: false });
  const doppler = dopplerReferenceDistanceM(input);
  const stepDistance = stepImpliedDistanceM(input);
  const stepDivergence =
    stepDistance != null && stepDistance > 0
      ? (stored.distanceM - stepDistance) / stepDistance
      : null;
  const stride = input.stride ?? DEFAULT_STRIDE;
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
    v3NoSensorsDistanceM: noSensors.distanceM,
    stepCount: stored.stepCount,
    stepDistanceM: stepDistance,
    stepBridgedDistanceM: stored.stepBridgedDistanceM,
    strideWalkM: stride.walkM,
    strideRunM: stride.runM,
    stepDivergence,
    zuptFixCount: stored.zuptFixCount,
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
    noSensorsDistanceM: Math.round(noSensors.distanceM),
    stepCount: stored.stepCount,
    stepDistanceM: stepDistance == null ? null : Math.round(stepDistance),
    stepBridgedDistanceM: Math.round(stored.stepBridgedDistanceM),
    zuptFixCount: stored.zuptFixCount,
  });
  // C3.2: the pedometer is independent of position noise — F3's blind spot. Flag, don't correct.
  if (stepDivergence != null && Math.abs(stepDivergence) > STEP_CROSSCHECK_MAX_DIVERGENCE) {
    console.warn('[metrics] distance disagrees with step count', {
      sessionId,
      distanceM: Math.round(stored.distanceM),
      stepDistanceM: Math.round(stepDistance ?? 0),
      divergence: Number(stepDivergence.toFixed(2)),
      strideLearned: stride.walkLearned || stride.runLearned,
    });
  }
};

/** C3.3: a clean session teaches the player's stride; a recomputed one that is no longer clean un-teaches it. */
const learnStride = async ({
  sessionId,
  userId,
  computed,
}: {
  sessionId: string;
  userId: string | null;
  computed: ComputedSessionMetrics;
}) => {
  if (!userId || computed.dataQuality !== 'good') {
    await clearStrideSamples(sessionId);
    return;
  }
  const learned = await saveStrideSamples({
    sessionId,
    userId,
    samples: computed.strideSamples,
    recordedAt: computed.computedAt,
  });
  if (learned.length > 0) {
    console.log('[metrics] stride sample', {
      sessionId,
      samples: learned.map((sample) => ({
        band: sample.band,
        steps: sample.steps,
        metresPerStep: Number((sample.metres / sample.steps).toFixed(3)),
      })),
    });
  }
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

  const stride = await getStrideEstimate(session.user_id ?? null);
  const input = toComputationInput({
    session,
    segments,
    pauses,
    points,
    massKg,
    stride,
    computedAt: session.ended_at,
  });
  const computed = computeSessionMetrics(input);

  await saveComputedMetrics({ sessionId, computed });

  // Local calibration only — never let it fail the stored result.
  try {
    await learnStride({ sessionId, userId: session.user_id ?? null, computed });
  } catch (error) {
    console.warn('[metrics] stride learning failed', error);
  }

  if (METRICS_COMPARISON_ENABLED) {
    // Diagnostics only — never let it fail the stored result.
    try {
      await recordComparison({ sessionId, input, stored: computed });
    } catch (error) {
      console.warn('[metrics] comparison failed', error);
    }
  }
};
