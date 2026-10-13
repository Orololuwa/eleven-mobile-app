import {
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getTrackingSession,
} from '../tracking/db';
import { toComputationInput } from './computation-input';
import { computeSessionMetrics } from './compute-session-metrics';
import { saveComputedMetrics } from './metrics-store';

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

  const computed = computeSessionMetrics(
    toComputationInput({
      session,
      segments,
      pauses,
      points,
      massKg,
      computedAt: session.ended_at,
    }),
  );

  await saveComputedMetrics({ sessionId, computed });
};
