import { cornersFromSessionRow } from '../tracking/attack-direction';
import type {
  TrackingPauseRow,
  TrackingPointRow,
  TrackingSegmentRow,
  TrackingSessionRow,
} from '../tracking/types';
import { normalizePlayStructure } from '../segment-display';
import type { ComputationInput } from './types';

/**
 * Map local tracking rows to a computation input. With `openEndsAt`, a still-open segment or pause
 * is treated as ending then (the live HUD); without it, open rows are dropped (end of session).
 */
export const toComputationInput = ({
  session,
  segments,
  pauses,
  points,
  massKg = null,
  openEndsAt = null,
  computedAt,
}: {
  session: TrackingSessionRow;
  segments: TrackingSegmentRow[];
  pauses: TrackingPauseRow[];
  points: TrackingPointRow[];
  massKg?: number | null;
  openEndsAt?: string | null;
  computedAt?: string;
}): ComputationInput => ({
  playStructure: normalizePlayStructure(session.play_structure),
  pitchId: session.pitch_id,
  corners: cornersFromSessionRow(session),
  segments: segments.flatMap((segment) => {
    const endedAt = segment.ended_at ?? openEndsAt;
    if (!endedAt) return [];
    return [
      {
        id: segment.id,
        segmentIndex: segment.segment_index,
        startedAt: segment.started_at,
        endedAt,
      },
    ];
  }),
  pauses: pauses.flatMap((pause) => {
    const endedAt = pause.ended_at ?? openEndsAt;
    if (!endedAt) return [];
    return [
      {
        segmentId: pause.segment_id,
        reason: pause.reason,
        startedAt: pause.started_at,
        endedAt,
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
    provider: point.provider ?? null,
  })),
  massKg,
  computedAt,
});
