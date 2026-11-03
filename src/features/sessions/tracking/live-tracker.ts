import {
  activeSecondsForSegment,
  admitPoint,
  classifyQuality,
  FILTER_TUNING,
  filterFixOf,
  filterSpanOf,
  manualPauseCrossing,
  residualStepMetres,
  speedSampleOf,
  startsNewRun,
  stepBridgeOf,
  zeroVelocityAt,
  type AdmittedPoint,
  type PlaneFrame,
} from '../summary/compute-session-metrics';
import { createRunFilter, type FilterStep, type RunFilter } from '../summary/motion-filter';
import { DEFAULT_STRIDE, type StrideEstimate } from '../summary/steps';
import type { ComputationInput, ComputationPoint } from '../summary/types';
import { passesLiveQualityGate } from './fix-gates';
import { centroidLatitude, scaleAtLatitude } from './geodesic';
import { newestTwo, type LiveReadoutBasis } from './live-metrics';
import { createTopSpeedScanner, type TopSpeedPeak, type TopSpeedScanner } from './speed-filter';

type SegmentState = {
  /** Admitted fixes so far — the ZUPT vote and the run / step tests look back over them. */
  points: AdmittedPoint[];
  filter: RunFilter | null;
  previousStep: FilterStep | null;
  /** Filter spans plus step-bridged spans. */
  distanceM: number;
  /** Seconds the filter measured (step bridging never counts as coverage). */
  coveredSeconds: number;
  acceptedCount: number;
  stepsBetweenFixes: number;
  topSpeed: TopSpeedScanner;
  /** Fastest span without Doppler — top speed under `position_delta`. */
  derivedPeak: TopSpeedPeak | null;
};

/**
 * The live HUD's v3 forward pass, kept open between refreshes: each stored fix is fed once, so a
 * refresh costs O(new fixes) instead of a pass over the whole session. Built only from the
 * primitives `computeSessionMetrics` uses; live-tracker.test.ts pins it to `computeLiveReadout`.
 *
 * The full pass on a 30-minute run took long enough on the phone that fixes queued behind it and
 * the HUD read "lost GPS" while the chip was delivering every second (3 Nov run).
 */
export type LiveTracker = {
  sessionId: string;
  /** Set at the first fix (origin: the first admitted one), as the full pass does. */
  frame: PlaneFrame | null;
  /** From the pitch corners when the session has them; otherwise the first fix decides. */
  cornerLatitude: number | null;
  stride: StrideEstimate;
  sensors: boolean;
  segments: Map<string, SegmentState>;
  usedOs: boolean;
  usedDerived: boolean;
  liveQualityFixCount: number;
  recentFixTimesMs: number[];
  /** Newest `sequence_index` fed — the next refresh reads only rows after it. */
  lastSequenceIndex: number;
};

export const createLiveTracker = ({
  sessionId,
  corners,
  stride,
  sensors = true,
}: {
  sessionId: string;
  corners: ComputationInput['corners'];
  stride: StrideEstimate | null;
  sensors?: boolean;
}): LiveTracker => ({
  sessionId,
  frame: null,
  cornerLatitude: corners
    ? centroidLatitude([
        corners.end_a_corner_1,
        corners.end_a_corner_2,
        corners.end_b_corner_1,
        corners.end_b_corner_2,
      ])
    : null,
  stride: stride ?? DEFAULT_STRIDE,
  sensors,
  segments: new Map(),
  usedOs: false,
  usedDerived: false,
  liveQualityFixCount: 0,
  recentFixTimesMs: [],
  lastSequenceIndex: -1,
});

const segmentState = (tracker: LiveTracker, segmentId: string): SegmentState => {
  const existing = tracker.segments.get(segmentId);
  if (existing) return existing;
  const created: SegmentState = {
    points: [],
    filter: null,
    previousStep: null,
    distanceM: 0,
    coveredSeconds: 0,
    acceptedCount: 0,
    stepsBetweenFixes: 0,
    topSpeed: createTopSpeedScanner(),
    derivedPeak: null,
  };
  tracker.segments.set(segmentId, created);
  return created;
};

/**
 * Feed one stored fix. False when it is older than the segment's newest — the incremental state
 * assumes time order, so the caller rebuilds from a sorted read instead.
 */
export const feedLiveTracker = ({
  tracker,
  point,
  sequenceIndex,
  segmentIds,
  pauses,
}: {
  tracker: LiveTracker;
  point: ComputationPoint;
  sequenceIndex: number;
  segmentIds: Set<string>;
  pauses: ComputationInput['pauses'];
}): boolean => {
  tracker.lastSequenceIndex = Math.max(tracker.lastSequenceIndex, sequenceIndex);
  tracker.frame ??= {
    origin: null,
    scale: scaleAtLatitude(tracker.cornerLatitude ?? point.lat),
  };
  if (passesLiveQualityGate(point.horizontalAccuracyM)) {
    tracker.liveQualityFixCount += 1;
    tracker.recentFixTimesMs = newestTwo([
      ...tracker.recentFixTimesMs,
      Date.parse(point.recordedAt),
    ]);
  }

  const admitted = admitPoint(point, segmentIds);
  if (!admitted) return true;
  const frame = tracker.frame;
  frame.origin ??= admitted;

  const segmentId = admitted.segmentId;
  const segment = segmentState(tracker, segmentId);
  const previous = segment.points[segment.points.length - 1];
  if (previous && admitted.atMs < previous.atMs) return false;
  segment.points.push(admitted);

  const crossesManualPause = manualPauseCrossing(pauses, segmentId);
  const zupt = tracker.sensors ? zeroVelocityAt(segment.points, segment.points.length - 1) : false;
  if (startsNewRun({ previous, point: admitted, crossesManualPause })) {
    segment.filter = createRunFilter(FILTER_TUNING);
    segment.previousStep = null;
  }

  let measured = false;
  const step = segment.filter!.push(filterFixOf(admitted, frame, zupt));
  if (step) {
    const state = { x: step.xFilt, p: step.pFilt };
    if (step.positionAccepted) segment.acceptedCount += 1;
    segment.topSpeed.push(speedSampleOf(step.tMs, state, frame));
    const previousStep = segment.previousStep;
    const span = previousStep
      ? filterSpanOf({
          segmentId,
          previousStep,
          previousState: { x: previousStep.xFilt, p: previousStep.pFilt },
          step,
          state,
          frame,
        })
      : null;
    if (span) {
      measured = true;
      segment.distanceM += span.metres;
      segment.coveredSeconds += (span.endMs - span.startMs) / 1000;
      if (span.fromOs) tracker.usedOs = true;
      else if (span.speedKmh != null) {
        tracker.usedDerived = true;
        if (!segment.derivedPeak || span.speedKmh > segment.derivedPeak.kmh) {
          segment.derivedPeak = { kmh: span.speedKmh, lat: span.to.lat, lng: span.to.lng };
        }
      }
    }
    segment.previousStep = step;
  }

  if (tracker.sensors && previous) {
    const bridge = stepBridgeOf({
      segmentId,
      previous,
      point: admitted,
      measured,
      crossesManualPause: crossesManualPause(previous.atMs, admitted.atMs),
      stride: tracker.stride,
    });
    segment.stepsBetweenFixes += bridge.steps ?? 0;
    if (bridge.span) segment.distanceM += bridge.span.metres;
  }
  return true;
};

/**
 * The readout basis now, with segments and pauses as of this refresh (open ones end now). Per
 * segment and session totals follow `computeSessionMetrics` line for line.
 */
export const liveTrackerBasis = ({
  tracker,
  input,
  segmentId,
}: {
  tracker: LiveTracker;
  input: Pick<ComputationInput, 'segments' | 'pauses'>;
  segmentId: string | null;
}): LiveReadoutBasis => {
  const suppressSpeed = !tracker.usedOs && !tracker.usedDerived;
  const rows = input.segments.map((segment) => {
    const state = tracker.segments.get(segment.id);
    const activeDurationSeconds = activeSecondsForSegment({ segment, pauses: input.pauses });
    const gapSeconds = Math.min(
      activeDurationSeconds,
      Math.max(0, Math.round(activeDurationSeconds - (state?.coveredSeconds ?? 0))),
    );
    const first = state?.points[0];
    const last = state?.points[state.points.length - 1];
    const residual = tracker.sensors
      ? residualStepMetres({
          segment,
          pauses: input.pauses,
          stepsBetweenFixes: state?.stepsBetweenFixes ?? 0,
          coveredMs: first && last ? last.atMs - first.atMs : 0,
          stride: tracker.stride,
        })
      : 0;
    const peak = suppressSpeed ? null : (state?.topSpeed.peak() ?? null);
    const top =
      peak && peak.kmh > 0
        ? peak
        : !tracker.usedOs && tracker.usedDerived
          ? (state?.derivedPeak ?? null)
          : null;
    return {
      segmentId: segment.id,
      activeDurationSeconds,
      gapSeconds,
      acceptedCount: state?.acceptedCount ?? 0,
      distanceM: (state?.distanceM ?? 0) + residual,
      topSpeedKmh: suppressSpeed ? null : (top?.kmh ?? null),
    };
  });

  const activeDurationSeconds = rows.reduce((sum, row) => sum + row.activeDurationSeconds, 0);
  const gapSeconds = rows.reduce((sum, row) => sum + row.gapSeconds, 0);
  const segment = segmentId ? rows.find((row) => row.segmentId === segmentId) : undefined;
  const fastest = rows.reduce<number | null>(
    (best, row) =>
      row.topSpeedKmh != null && (best == null || row.topSpeedKmh > best) ? row.topSpeedKmh : best,
    null,
  );
  return {
    distanceM: segment ? segment.distanceM : rows.reduce((sum, row) => sum + row.distanceM, 0),
    topSpeedKmh: segment ? segment.topSpeedKmh : fastest,
    activeDurationSeconds,
    gapSeconds,
    dataQuality: classifyQuality({
      gapSeconds,
      activeSeconds: activeDurationSeconds,
      acceptedFixCount: rows.reduce((sum, row) => sum + row.acceptedCount, 0),
    }),
    liveQualityFixCount: tracker.liveQualityFixCount,
    recentFixTimesMs: tracker.recentFixTimesMs,
  };
};
