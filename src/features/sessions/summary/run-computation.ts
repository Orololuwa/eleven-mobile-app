import { cornersFromSessionRow } from '../tracking/attack-direction';
import {
  getPausesForSession,
  getPointsForSession,
  getSegmentsForSession,
  getTrackingSession,
} from '../tracking/db';
import { normalizePlayStructure } from '../segment-display';
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

  const computed = computeSessionMetrics({
    playStructure: normalizePlayStructure(session.play_structure),
    pitchId: session.pitch_id,
    corners: cornersFromSessionRow(session),
    segments: segments.flatMap((segment) => {
      if (!segment.ended_at) return [];
      return [
        {
          id: segment.id,
          segmentIndex: segment.segment_index,
          startedAt: segment.started_at,
          endedAt: segment.ended_at,
        },
      ];
    }),
    pauses: pauses.flatMap((pause) => {
      if (!pause.ended_at) return [];
      return [
        {
          segmentId: pause.segment_id,
          reason: pause.reason,
          startedAt: pause.started_at,
          endedAt: pause.ended_at,
        },
      ];
    }),
    points: points.map((point) => ({
      segmentId: point.segment_id,
      recordedAt: point.recorded_at,
      lat: point.lat,
      lng: point.lng,
      speedKmh: point.speed_kmh,
      speedAccuracyMps: point.speed_accuracy_mps,
      horizontalAccuracyM: point.horizontal_accuracy_m,
    })),
    massKg,
    computedAt: session.ended_at,
  });

  await saveComputedMetrics({ sessionId, computed });
};
