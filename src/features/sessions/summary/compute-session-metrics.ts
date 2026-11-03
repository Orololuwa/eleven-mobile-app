import { TOP_SPEED_CEILING_KMH } from '../tracking/constants';
import { passesContinuityGate, passesQualityGate } from '../tracking/fix-gates';
import {
  centroidLatitude,
  planeMetres,
  scaleAtLatitude,
  type DegreeScale,
  type LatLng,
} from '../tracking/geodesic';
import { determineTopSpeedPeak, passesSpeedConfidence } from '../tracking/speed-filter';
import {
  ALGORITHM_VERSION,
  CALORIE_KCAL_PER_KG_PER_KM,
  FILTER_ACCEL_SIGMA_MPS2,
  FILTER_DIRECTION_MIN_SPEED_MPS,
  FILTER_HEADING_CONFIDENCE_RATIO,
  FILTER_FUSED_POSITION_SIGMA_FLOOR_M,
  FILTER_FUSED_SPEED_SIGMA_FLOOR_MPS,
  FILTER_GATE_LOCKOUT_FIXES,
  FILTER_GATE_WARMUP_UPDATES,
  FILTER_POSITION_INNOVATION_GATE,
  FILTER_POSITION_SIGMA_FLOOR_M,
  FILTER_RESET_GAP_SECONDS,
  FILTER_SPEED_SIGMA_DEFAULT_MPS,
  FILTER_SPEED_SIGMA_FLOOR_MPS,
  FILTER_ONLY_ALGORITHM_VERSION,
  FILTER_STATIONARY_SPEED_MPS,
  GAP_BRIDGE_MAX_SECONDS,
  GAP_POSITION_SIGMA_MAX_M,
  LEGACY_ALGORITHM_VERSION,
  QUALITY_GOOD_GAP,
  QUALITY_INSUFFICIENT_GAP,
  QUALITY_MIN_ACTIVE_SECONDS,
  QUALITY_MIN_FIXES,
  SPRINT_MERGE_CAP_SECONDS,
  SPRINT_MERGE_GAP_SECONDS,
  SPRINT_MIN_DISPLACEMENT_M,
  SPRINT_MIN_FIXES,
  SPRINT_MIN_SECONDS,
  STEP_RESIDUAL_MIN_STEPS,
  STRIDE_CHUNK_SECONDS,
  ZUPT_ACCEL_MOVING_MIN,
  ZUPT_ACCEL_VARIANCE_MAX,
  ZUPT_DOPPLER_MAX_MPS,
  ZUPT_MIN_VOTES,
  ZUPT_SPEED_SIGMA_MPS,
  ZUPT_SUSTAIN_SECONDS,
} from './constants';
import {
  filterRun,
  positionSigmaOf,
  smoothRun,
  speedOf,
  speedSigmaOf,
  type FilterFix,
  type FilterStep,
  type FilterTuning,
} from './motion-filter';
import { metForSpeed, resolveSpeedBands, zoneForSpeed, type ZoneName } from './speed-bands';
import { DEFAULT_STRIDE, stepDelta, stepMetres, strideBand, type StrideEstimate } from './steps';
import type {
  ComputationInput,
  ComputationPause,
  ComputationPoint,
  ComputationSegment,
  ComputedSegmentMetrics,
  ComputedSessionMetrics,
  ComputedSprint,
  DataQuality,
  SpeedSource,
  StrideSample,
  ZoneSeconds,
} from './types';

type AcceptedFix = ComputationPoint & { atMs: number; osSpeedKmh: number | null };

export type BridgedSpan = {
  segmentId: string;
  startMs: number;
  endMs: number;
  metres: number;
  speedKmh: number | null;
  fromOs: boolean;
  /**
   * C3.4: distance from steps × stride across a GPS gap. Counts toward distance and calories only —
   * never zones, sprints, top speed or coverage, because it has no position or speed of its own.
   */
  fromSteps?: boolean;
  from: LatLng;
  to: LatLng;
};

const emptyZones = (): ZoneSeconds => ({
  walk: 0,
  jog: 0,
  run: 0,
  high_run: 0,
  sprint: 0,
});

const iso = (ms: number) => new Date(ms).toISOString();

/** Append in place — rebuilding the array per fix made long sessions quadratic. */
const pushTo = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

const osSpeedKmh = (point: ComputationPoint) => {
  if (point.speedKmh == null || point.speedKmh <= 0) return null;
  if (
    !passesSpeedConfidence({
      speed_accuracy_mps: point.speedAccuracyMps,
      horizontal_accuracy_m: point.horizontalAccuracyM,
    })
  )
    return null;
  if (point.speedKmh >= TOP_SPEED_CEILING_KMH) return null;
  return point.speedKmh;
};

export const pauseOverlapSec = ({
  startMs,
  endMs,
  pauses,
}: {
  startMs: number;
  endMs: number;
  pauses: ComputationPause[];
}) =>
  pauses.reduce((sum, pause) => {
    if (pause.reason !== 'manual') return sum;
    const pauseStart = Date.parse(pause.startedAt);
    const pauseEnd = Date.parse(pause.endedAt);
    const overlap = Math.min(endMs, pauseEnd) - Math.max(startMs, pauseStart);
    return sum + Math.max(0, overlap) / 1000;
  }, 0);

export const activeSecondsForSegment = ({
  segment,
  pauses,
}: {
  segment: ComputationSegment;
  pauses: ComputationPause[];
}) => {
  const startMs = Date.parse(segment.startedAt);
  const endMs = Date.parse(segment.endedAt);
  const span = Math.max(0, (endMs - startMs) / 1000);
  const manual = pauses
    .filter((pause) => pause.segmentId === segment.id && pause.reason === 'manual')
    .reduce((sum, pause) => sum + pauseOverlapSec({ startMs, endMs, pauses: [pause] }), 0);
  return Math.max(0, Math.round(span - manual));
};

const longAxisMetres = (corners: NonNullable<ComputationInput['corners']>, scale: DegreeScale) => {
  const mid = (a: LatLng, b: LatLng): LatLng => ({
    lat: (a.lat + b.lat) / 2,
    lng: (a.lng + b.lng) / 2,
  });
  return planeMetres(
    mid(corners.end_a_corner_1, corners.end_a_corner_2),
    mid(corners.end_b_corner_1, corners.end_b_corner_2),
    scale,
  );
};

/** 0.5 §3.9. The live HUD (live-tracker) classifies with this too — never a second copy. */
export const classifyQuality = ({
  gapSeconds,
  activeSeconds,
  acceptedFixCount,
}: {
  gapSeconds: number;
  activeSeconds: number;
  acceptedFixCount: number;
}): DataQuality => {
  if (activeSeconds <= 0) return 'insufficient';
  const gapFraction = gapSeconds / activeSeconds;
  if (
    gapFraction > QUALITY_INSUFFICIENT_GAP ||
    acceptedFixCount < QUALITY_MIN_FIXES ||
    activeSeconds < QUALITY_MIN_ACTIVE_SECONDS
  ) {
    return 'insufficient';
  }
  return gapFraction <= QUALITY_GOOD_GAP ? 'good' : 'estimated';
};

const kcalFromTime = ({ seconds, met, massKg }: { seconds: number; met: number; massKg: number }) =>
  ((met * 3.5 * massKg) / 200) * (seconds / 60);

type SprintWindow = {
  segmentId: string;
  startMs: number;
  endMs: number;
  metres: number;
  fixCount: number;
  peakSpeedKmh: number;
  peak: LatLng;
  belowAccum: number;
};

const detectSprints = ({
  spans,
  sprintMinKmh,
}: {
  spans: BridgedSpan[];
  sprintMinKmh: number;
}): Omit<ComputedSprint, 'effortIndex'>[] => {
  const bySegment = new Map<string, BridgedSpan[]>();
  spans.forEach((span) => {
    if (span.fromSteps) return;
    const list = bySegment.get(span.segmentId) ?? [];
    list.push(span);
    bySegment.set(span.segmentId, list);
  });

  const efforts: Omit<ComputedSprint, 'effortIndex'>[] = [];

  bySegment.forEach((segmentSpans) => {
    const groups: BridgedSpan[][] = [];
    segmentSpans.forEach((span) => {
      const group = groups[groups.length - 1];
      const previous = group?.[group.length - 1];
      if (previous && previous.endMs === span.startMs) {
        group.push(span);
        return;
      }
      groups.push([span]);
    });

    groups.forEach((group) => {
      const windows = qualifyingWindows(group, sprintMinKmh);
      let open: SprintWindow | null = null;
      let openEndIndex = -1;

      windows.forEach((window) => {
        if (!open) {
          open = window;
          openEndIndex = window.endIndex;
          return;
        }
        const below = belowSecondsBetween({
          group,
          fromIndex: openEndIndex,
          toIndex: window.startIndex,
          sprintMinKmh,
        });
        const canMerge =
          below != null &&
          below <= SPRINT_MERGE_GAP_SECONDS &&
          open.belowAccum + below <= SPRINT_MERGE_CAP_SECONDS;
        if (!canMerge) {
          efforts.push(effortFromWindow(open));
          open = window;
          openEndIndex = window.endIndex;
          return;
        }
        open = {
          ...open,
          endMs: window.endMs,
          metres:
            open.metres + metresBetween(group, openEndIndex, window.startIndex) + window.metres,
          peakSpeedKmh: Math.max(open.peakSpeedKmh, window.peakSpeedKmh),
          peak: window.peakSpeedKmh > open.peakSpeedKmh ? window.peak : open.peak,
          belowAccum: open.belowAccum + below,
        };
        openEndIndex = window.endIndex;
      });

      if (open) efforts.push(effortFromWindow(open));
    });
  });

  return efforts.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
};

type IndexedWindow = SprintWindow & { startIndex: number; endIndex: number };

const qualifyingWindows = (group: BridgedSpan[], sprintMinKmh: number): IndexedWindow[] => {
  const windows: IndexedWindow[] = [];
  let start: number | null = null;

  const close = (end: number) => {
    if (start == null) return;
    const slice = group.slice(start, end);
    const above = slice.filter((span) => (span.speedKmh ?? 0) >= sprintMinKmh);
    start = null;
    if (above.length === 0) return;
    const first = above[0];
    const last = above[above.length - 1];
    if (!first || !last) return;
    const duration = (last.endMs - first.startMs) / 1000;
    const metres = above.reduce((sum, span) => sum + span.metres, 0);
    const fixCount = above.length + 1;
    if (
      duration < SPRINT_MIN_SECONDS ||
      fixCount < SPRINT_MIN_FIXES ||
      metres < SPRINT_MIN_DISPLACEMENT_M
    ) {
      return;
    }
    const peakSpan = above.reduce((best, span) =>
      (span.speedKmh ?? 0) > (best.speedKmh ?? 0) ? span : best,
    );
    windows.push({
      segmentId: first.segmentId,
      startMs: first.startMs,
      endMs: last.endMs,
      metres,
      fixCount,
      peakSpeedKmh: peakSpan.speedKmh ?? sprintMinKmh,
      peak: peakSpan.from,
      belowAccum: 0,
      startIndex: group.indexOf(first),
      endIndex: group.indexOf(last),
    });
  };

  group.forEach((span, index) => {
    const above = (span.speedKmh ?? 0) >= sprintMinKmh;
    if (above && start == null) start = index;
    if (!above && start != null) close(index);
  });
  if (start != null) close(group.length);
  return windows;
};

const belowSecondsBetween = ({
  group,
  fromIndex,
  toIndex,
  sprintMinKmh,
}: {
  group: BridgedSpan[];
  fromIndex: number;
  toIndex: number;
  sprintMinKmh: number;
}) => {
  if (toIndex <= fromIndex) return 0;
  let below = 0;
  for (let index = fromIndex + 1; index < toIndex; index += 1) {
    const span = group[index];
    const previous = group[index - 1];
    if (!span || !previous || previous.endMs !== span.startMs) return null;
    if ((span.speedKmh ?? 0) < sprintMinKmh) below += (span.endMs - span.startMs) / 1000;
  }
  return below;
};

const metresBetween = (group: BridgedSpan[], fromIndex: number, toIndex: number) => {
  let metres = 0;
  for (let index = fromIndex + 1; index < toIndex; index += 1) {
    metres += group[index]?.metres ?? 0;
  }
  return metres;
};

const effortFromWindow = (window: SprintWindow): Omit<ComputedSprint, 'effortIndex'> => ({
  segmentId: window.segmentId,
  startedAt: iso(window.startMs),
  endedAt: iso(window.endMs),
  durationS: (window.endMs - window.startMs) / 1000,
  distanceM: window.metres,
  peakSpeedKmh: window.peakSpeedKmh,
  peakLat: window.peak.lat,
  peakLng: window.peak.lng,
});

const roundZones = (zones: Record<ZoneName, number>): ZoneSeconds => ({
  walk: Math.round(zones.walk),
  jog: Math.round(zones.jog),
  run: Math.round(zones.run),
  high_run: Math.round(zones.high_run),
  sprint: Math.round(zones.sprint),
});

const sumZones = (rows: ZoneSeconds[]): ZoneSeconds =>
  rows.reduce(
    (sum, zones) => ({
      walk: sum.walk + zones.walk,
      jog: sum.jog + zones.jog,
      run: sum.run + zones.run,
      high_run: sum.high_run + zones.high_run,
      sprint: sum.sprint + zones.sprint,
    }),
    emptyZones(),
  );

/** `filter`: the Kalman pipeline (v3, plus motion sensors in v3.1). `v2`: the legacy position sum. */
export type MetricsAlgorithm = 'v2' | 'filter';

export type SpeedSample = {
  recorded_at: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  speed_accuracy_mps: number | null;
  horizontal_accuracy_m: number | null;
};

/** What an algorithm hands the shared tail: spans to measure, and per-segment evidence. */
type SpanBuild = {
  spans: BridgedSpan[];
  acceptedCount: Map<string, number>;
  /** Fed to the 0.4.2 F1–F4 chain for top speed. */
  speedSamples: Map<string, SpeedSample[]>;
  /** C3.4: step-derived metres per segment outside any fix-to-fix interval (before / after / none). */
  stepResidualMetres: Map<string, number>;
  zuptFixCount: number;
  strideSamples: StrideSample[];
};

export const FILTER_TUNING: FilterTuning = {
  accelSigmaMps2: FILTER_ACCEL_SIGMA_MPS2,
  positionSigmaFloorM: FILTER_POSITION_SIGMA_FLOOR_M,
  speedSigmaFloorMps: FILTER_SPEED_SIGMA_FLOOR_MPS,
  speedSigmaDefaultMps: FILTER_SPEED_SIGMA_DEFAULT_MPS,
  fusedPositionSigmaFloorM: FILTER_FUSED_POSITION_SIGMA_FLOOR_M,
  fusedSpeedSigmaFloorMps: FILTER_FUSED_SPEED_SIGMA_FLOOR_MPS,
  positionInnovationGate: FILTER_POSITION_INNOVATION_GATE,
  gateWarmupUpdates: FILTER_GATE_WARMUP_UPDATES,
  gateLockoutFixes: FILTER_GATE_LOCKOUT_FIXES,
  directionMinSpeedMps: FILTER_DIRECTION_MIN_SPEED_MPS,
  headingConfidenceRatio: FILTER_HEADING_CONFIDENCE_RATIO,
  stationarySpeedMps: FILTER_STATIONARY_SPEED_MPS,
  zuptSpeedSigmaMps: ZUPT_SPEED_SIGMA_MPS,
};

const toSpeedSample = (fix: AcceptedFix): SpeedSample => ({
  recorded_at: fix.recordedAt,
  lat: fix.lat,
  lng: fix.lng,
  speed_kmh: fix.speedKmh,
  speed_accuracy_mps: fix.speedAccuracyMps,
  horizontal_accuracy_m: fix.horizontalAccuracyM,
});

/** v2: distance is the sum of bridged position deltas between quality-gated fixes. */
const buildV2Spans = ({
  input,
  segmentIds,
  scale,
  passesQuality,
}: {
  input: ComputationInput;
  segmentIds: Set<string>;
  scale: DegreeScale;
  passesQuality: (accuracyM: number | null) => boolean;
}): SpanBuild => {
  const accepted: AcceptedFix[] = input.points
    .filter((point) => point.segmentId && passesQuality(point.horizontalAccuracyM))
    .map((point) => ({
      ...point,
      atMs: Date.parse(point.recordedAt),
      osSpeedKmh: osSpeedKmh(point),
    }))
    .sort((a, b) => a.atMs - b.atMs || a.segmentId.localeCompare(b.segmentId));

  const acceptedCount = new Map<string, number>();
  const speedSamples = new Map<string, SpeedSample[]>();
  accepted.forEach((fix) => {
    if (!segmentIds.has(fix.segmentId)) return;
    acceptedCount.set(fix.segmentId, (acceptedCount.get(fix.segmentId) ?? 0) + 1);
    pushTo(speedSamples, fix.segmentId, toSpeedSample(fix));
  });

  const spans: BridgedSpan[] = [];
  for (let index = 1; index < accepted.length; index += 1) {
    const previous = accepted[index - 1];
    const current = accepted[index];
    if (!previous || !current) continue;
    if (previous.segmentId !== current.segmentId) continue;
    if (!segmentIds.has(previous.segmentId)) continue;

    const dt = (current.atMs - previous.atMs) / 1000;
    if (dt <= 0) continue;

    const metres = planeMetres(previous, current, scale);
    const manualOverlap = pauseOverlapSec({
      startMs: previous.atMs,
      endMs: current.atMs,
      pauses: input.pauses.filter((pause) => pause.segmentId === previous.segmentId),
    });
    const impliedKmh = (metres / dt) * 3.6;
    const bridged =
      manualOverlap === 0 && dt <= GAP_BRIDGE_MAX_SECONDS && impliedKmh < TOP_SPEED_CEILING_KMH;
    if (!bridged) continue;

    const derived = impliedKmh > 0 && impliedKmh < TOP_SPEED_CEILING_KMH ? impliedKmh : null;
    spans.push({
      segmentId: previous.segmentId,
      startMs: previous.atMs,
      endMs: current.atMs,
      metres,
      speedKmh: previous.osSpeedKmh ?? derived,
      fromOs: previous.osSpeedKmh != null,
      from: previous,
      to: current,
    });
  }
  return {
    spans,
    acceptedCount,
    speedSamples,
    stepResidualMetres: new Map(),
    zuptFixCount: 0,
    strideSamples: [],
  };
};

type StillnessPoint = {
  atMs: number;
  speedKmh: number | null;
  stepCount?: number | null;
  accelVariance?: number | null;
};

/**
 * C2: which fixes are zero-velocity updates. Three independent witnesses each vote "standing":
 * Doppler ≤ walking threshold for the whole trailing window, no step counted over it, and the
 * accelerometer quiet since the last fix. At least two must agree — one signal alone is the naive
 * displacement gate that cut a clean jog from 5.04 km to 1.90 km (Amendment 01 §5) — and an
 * accelerometer that says walking vetoes it outright (ZUPT_ACCEL_MOVING_MIN).
 */
export const zeroVelocityFlags = (points: StillnessPoint[]): boolean[] =>
  points.map((_, index) => zeroVelocityAt(points, index));

/** The ZUPT vote for `points[index]`. Looks only backward, so live can call it as each fix lands. */
export const zeroVelocityAt = (points: StillnessPoint[], index: number): boolean => {
  const windowMs = ZUPT_SUSTAIN_SECONDS * 1000;
  const point = points[index]!;
  // Moving veto: an accelerometer in walking range blocks a ZUPT, however the others vote.
  if (point.accelVariance != null && point.accelVariance >= ZUPT_ACCEL_MOVING_MIN) return false;

  let firstInWindow = index;
  let dopplerQuiet = true;
  for (let j = index; j >= 0; j -= 1) {
    const earlier = points[j]!;
    if (point.atMs - earlier.atMs > windowMs) break;
    firstInWindow = j;
    if (earlier.speedKmh == null || earlier.speedKmh / 3.6 > ZUPT_DOPPLER_MAX_MPS) {
      dopplerQuiet = false;
      break;
    }
  }
  // Sustained: the quiet readings span most of the window, not one fix.
  const dopplerVote = dopplerQuiet && point.atMs - points[firstInWindow]!.atMs >= windowMs - 1000;

  let stepVote = false;
  for (let j = index - 1; j >= 0; j -= 1) {
    const earlier = points[j]!;
    if (point.atMs - earlier.atMs < windowMs) continue;
    stepVote =
      stepDelta({
        fromCount: earlier.stepCount,
        fromMs: earlier.atMs,
        toCount: point.stepCount,
        toMs: point.atMs,
      }) === 0;
    break;
  }

  const accelVote = point.accelVariance != null && point.accelVariance <= ZUPT_ACCEL_VARIANCE_MAX;

  return [dopplerVote, stepVote, accelVote].filter(Boolean).length >= ZUPT_MIN_VOTES;
};

/** A stored fix as v3 sees it: continuity-grade, in a known segment, with its time parsed. */
export type AdmittedPoint = ComputationPoint & { atMs: number };

export const admitPoint = (
  point: ComputationPoint,
  segmentIds: Set<string>,
): AdmittedPoint | null =>
  segmentIds.has(point.segmentId) && passesContinuityGate(point.horizontalAccuracyM)
    ? { ...point, atMs: Date.parse(point.recordedAt) }
    : null;

const admittedPoints = (points: ComputationPoint[], segmentIds: Set<string>) =>
  points.flatMap((point) => admitPoint(point, segmentIds) ?? []);

/** Plane frame of the session: metres east / north of its first admitted fix. */
export type PlaneFrame = { origin: LatLng | null; scale: DegreeScale };

export const filterFixOf = (point: AdmittedPoint, frame: PlaneFrame, zupt: boolean): FilterFix => ({
  tMs: point.atMs,
  x: (point.lng - (frame.origin?.lng ?? 0)) * frame.scale.mPerDegLng,
  y: (point.lat - (frame.origin?.lat ?? 0)) * frame.scale.mPerDegLat,
  horizontalAccuracyM: point.horizontalAccuracyM ?? Number.POSITIVE_INFINITY,
  speedMps:
    point.speedKmh != null && point.speedKmh >= 0 && point.speedKmh < TOP_SPEED_CEILING_KMH
      ? point.speedKmh / 3.6
      : null,
  speedAccuracyMps: point.speedAccuracyMps,
  provider: point.provider ?? null,
  zupt,
});

const latLngOf = (state: number[], frame: PlaneFrame): LatLng => ({
  lat: (frame.origin?.lat ?? 0) + state[1]! / frame.scale.mPerDegLat,
  lng: (frame.origin?.lng ?? 0) + state[0]! / frame.scale.mPerDegLng,
});

type FilterState = { x: number[]; p: number[][] };

/** The filter's estimate at a step, as a top-speed sample (F1–F4 read state, not raw Doppler). */
export const speedSampleOf = (tMs: number, state: FilterState, frame: PlaneFrame): SpeedSample => {
  const at = latLngOf(state.x, frame);
  return {
    recorded_at: iso(tMs),
    lat: at.lat,
    lng: at.lng,
    speed_kmh: speedOf(state.x) * 3.6,
    speed_accuracy_mps: speedSigmaOf(state.x, state.p),
    horizontal_accuracy_m: positionSigmaOf(state.p),
  };
};

/**
 * The interval between two filter steps, or null when it does not count. Uncertainty bound, not a
 * time bound: stop claiming distance once we no longer know where the player is.
 */
export const filterSpanOf = ({
  segmentId,
  previousStep,
  previousState,
  step,
  state,
  frame,
}: {
  segmentId: string;
  previousStep: FilterStep;
  previousState: FilterState;
  step: FilterStep;
  state: FilterState;
  frame: PlaneFrame;
}): BridgedSpan | null => {
  if (positionSigmaOf(step.pPred) > GAP_POSITION_SIGMA_MAX_M) return null;
  const metres = ((speedOf(previousState.x) + speedOf(state.x)) / 2) * step.dt;
  const meanKmh = (metres / step.dt) * 3.6;
  if (meanKmh >= TOP_SPEED_CEILING_KMH) return null;
  return {
    segmentId,
    startMs: previousStep.tMs,
    endMs: step.tMs,
    metres,
    speedKmh: meanKmh,
    fromOs: step.speedUsed || previousStep.speedUsed,
    from: latLngOf(previousState.x, frame),
    to: latLngOf(state.x, frame),
  };
};

/**
 * C3.4 for one fix-to-fix interval: the steps counted across it (null when there is no reading),
 * and — when the filter did not measure it — the step-bridged span. 0 steps is a measured 0 (§3.5:
 * standing still); a missing reading is no evidence.
 */
export const stepBridgeOf = ({
  segmentId,
  previous,
  point,
  measured,
  crossesManualPause,
  stride,
}: {
  segmentId: string;
  previous: AdmittedPoint;
  point: AdmittedPoint;
  measured: boolean;
  crossesManualPause: boolean;
  stride: StrideEstimate;
}): { steps: number | null; span: BridgedSpan | null } => {
  if (point.atMs <= previous.atMs || crossesManualPause) return { steps: null, span: null };
  const steps = stepDelta({
    fromCount: previous.stepCount,
    fromMs: previous.atMs,
    toCount: point.stepCount,
    toMs: point.atMs,
  });
  if (steps == null || measured) return { steps, span: null };
  const seconds = (point.atMs - previous.atMs) / 1000;
  const metres = stepMetres({ steps, seconds, stride });
  if (metres <= 0) return { steps, span: null };
  return {
    steps,
    span: {
      segmentId,
      startMs: previous.atMs,
      endMs: point.atMs,
      metres,
      speedKmh: (metres / seconds) * 3.6,
      fromOs: false,
      fromSteps: true,
      from: previous,
      to: point,
    },
  };
};

/** A long silence or a manual pause starts a fresh run: the old state says nothing about now. */
export const startsNewRun = ({
  previous,
  point,
  crossesManualPause,
}: {
  previous: AdmittedPoint | undefined;
  point: AdmittedPoint;
  crossesManualPause: (fromMs: number, toMs: number) => boolean;
}) =>
  !previous ||
  (point.atMs - previous.atMs) / 1000 > FILTER_RESET_GAP_SECONDS ||
  crossesManualPause(previous.atMs, point.atMs);

/** Manual pauses of one segment, as the run-break / step-bridge test. */
export const manualPauseCrossing = (pauses: ComputationPause[], segmentId: string) => {
  const manual = pauses.filter(
    (pause) => pause.segmentId === segmentId && pause.reason === 'manual',
  );
  return (fromMs: number, toMs: number) =>
    pauseOverlapSec({ startMs: fromMs, endMs: toMs, pauses: manual }) > 0;
};

/**
 * v3 (Amendment 03): one Kalman filter per segment fusing position and Doppler speed. Distance is
 * the integral of filtered speed; an interval counts while the predicted position σ stays under
 * GAP_POSITION_SIGMA_MAX_M (replaces the 5 s bridge). `smooth` adds the RTS backward pass — the
 * summary has the whole session, the live HUD does not.
 *
 * v3.1 (`sensors`): C2 zero-velocity updates where motion sensors agree the player is standing, and
 * C3.4 step bridging — an interval GPS cannot measure gets steps × stride as distance (never
 * position), and steps outside every fix-to-fix interval (or in a segment with no usable fix at
 * all) are added per segment.
 */
const buildV3Spans = ({
  input,
  segmentIds,
  scale,
  smooth,
  sensors,
}: {
  input: ComputationInput;
  segmentIds: Set<string>;
  scale: DegreeScale;
  smooth: boolean;
  sensors: boolean;
}): SpanBuild => {
  const stride: StrideEstimate = input.stride ?? DEFAULT_STRIDE;
  const admitted = admittedPoints(input.points, segmentIds).sort((a, b) => a.atMs - b.atMs);

  const spans: BridgedSpan[] = [];
  const acceptedCount = new Map<string, number>();
  const speedSamples = new Map<string, SpeedSample[]>();
  const stepResidualMetres = new Map<string, number>();
  const strideTotals = new Map<StrideSample['band'], { metres: number; steps: number }>();
  let zuptFixCount = 0;

  const frame: PlaneFrame = { origin: admitted[0] ?? null, scale };

  const bySegment = new Map<string, AdmittedPoint[]>();
  admitted.forEach((point) => pushTo(bySegment, point.segmentId, point));

  bySegment.forEach((points, segmentId) => {
    const crossesManualPause = manualPauseCrossing(input.pauses, segmentId);
    const zupt = sensors ? zeroVelocityFlags(points) : points.map(() => false);

    const runs: { point: AdmittedPoint; zupt: boolean }[][] = [];
    points.forEach((point, index) => {
      const entry = { point, zupt: zupt[index]! };
      if (startsNewRun({ previous: points[index - 1], point, crossesManualPause })) {
        runs.push([entry]);
      } else {
        runs[runs.length - 1]!.push(entry);
      }
    });

    /** End time of every fix-to-fix interval the filter measured. */
    const measuredEnds = new Set<number>();
    const segmentSpans: BridgedSpan[] = [];

    runs.forEach((run) => {
      const steps = filterRun(
        run.map((entry) => filterFixOf(entry.point, frame, entry.zupt)),
        FILTER_TUNING,
      );
      const states = smooth
        ? smoothRun(steps)
        : steps.map((step) => ({ x: step.xFilt, p: step.pFilt }));

      steps.forEach((step, index) => {
        const state = states[index]!;
        if (step.positionAccepted) {
          acceptedCount.set(segmentId, (acceptedCount.get(segmentId) ?? 0) + 1);
        }
        if (step.zupt) zuptFixCount += 1;
        pushTo(speedSamples, segmentId, speedSampleOf(step.tMs, state, frame));

        const previousStep = steps[index - 1];
        const previousState = states[index - 1];
        if (!previousStep || !previousState) return;
        const span = filterSpanOf({ segmentId, previousStep, previousState, step, state, frame });
        if (!span) return;
        measuredEnds.add(step.tMs);
        segmentSpans.push(span);
      });
    });

    if (sensors) {
      // C3.4: where GPS measured nothing between two fixes, the step counter says how far — not
      // where.
      let stepsBetweenFixes = 0;
      points.forEach((point, index) => {
        const previous = points[index - 1];
        if (!previous) return;
        const bridge = stepBridgeOf({
          segmentId,
          previous,
          point,
          measured: measuredEnds.has(point.atMs),
          crossesManualPause: crossesManualPause(previous.atMs, point.atMs),
          stride,
        });
        stepsBetweenFixes += bridge.steps ?? 0;
        if (bridge.span) segmentSpans.push(bridge.span);
      });

      const segment = input.segments.find((row) => row.id === segmentId);
      const residual = residualStepMetres({
        segment,
        pauses: input.pauses,
        stepsBetweenFixes,
        coveredMs: points[points.length - 1]!.atMs - points[0]!.atMs,
        stride,
      });
      if (residual > 0) stepResidualMetres.set(segmentId, residual);

      collectStrideSamples({ spans: segmentSpans, points, totals: strideTotals });
    }

    spans.push(...segmentSpans);
  });

  if (sensors) {
    // Segments with no usable fix at all: the step counter is the only witness (the storm case).
    input.segments.forEach((segment) => {
      if (!segmentIds.has(segment.id) || bySegment.has(segment.id)) return;
      const residual = residualStepMetres({
        segment,
        pauses: input.pauses,
        stepsBetweenFixes: 0,
        coveredMs: 0,
        stride,
      });
      if (residual > 0) stepResidualMetres.set(segment.id, residual);
    });
  }

  spans.sort((a, b) => a.startMs - b.startMs);
  return {
    spans,
    acceptedCount,
    speedSamples,
    stepResidualMetres,
    zuptFixCount,
    strideSamples: [...strideTotals.entries()].map(([band, total]) => ({ band, ...total })),
  };
};

/**
 * Steps the segment counted that no fix-to-fix interval accounts for — before the first fix, after
 * the last, or all of them when GPS supplied nothing — as metres at the player's stride.
 */
export const residualStepMetres = ({
  segment,
  pauses,
  stepsBetweenFixes,
  coveredMs,
  stride,
}: {
  segment: ComputationSegment | undefined;
  pauses: ComputationPause[];
  stepsBetweenFixes: number;
  coveredMs: number;
  stride: StrideEstimate;
}) => {
  if (segment?.stepCount == null) return 0;
  const residual = segment.stepCount - stepsBetweenFixes;
  if (residual < STEP_RESIDUAL_MIN_STEPS) return 0;
  const uncoveredSeconds = Math.max(
    1,
    activeSecondsForSegment({ segment, pauses }) - Math.max(0, coveredMs) / 1000,
  );
  return stepMetres({ steps: residual, seconds: uncoveredSeconds, stride });
};

/**
 * C3.3 calibration: GPS-measured stretches of at least STRIDE_CHUNK_SECONDS, each with the steps
 * counted between its first and last fix, binned by that stretch's cadence.
 */
const collectStrideSamples = ({
  spans,
  points,
  totals,
}: {
  spans: BridgedSpan[];
  points: { atMs: number; stepCount?: number | null }[];
  totals: Map<StrideSample['band'], { metres: number; steps: number }>;
}) => {
  const countAt = new Map(points.map((point) => [point.atMs, point.stepCount]));
  const measured = spans.filter((span) => !span.fromSteps).sort((a, b) => a.startMs - b.startMs);
  let chunk: { startMs: number; endMs: number; metres: number } | null = null;

  const close = () => {
    if (!chunk) return;
    const steps = stepDelta({
      fromCount: countAt.get(chunk.startMs),
      fromMs: chunk.startMs,
      toCount: countAt.get(chunk.endMs),
      toMs: chunk.endMs,
    });
    const seconds = (chunk.endMs - chunk.startMs) / 1000;
    // No steps over a measured stretch says nothing about stride (phone not counting, or standing).
    if (steps != null && steps > 0 && chunk.metres >= 1) {
      const band = strideBand((steps / seconds) * 60);
      const total = totals.get(band) ?? { metres: 0, steps: 0 };
      totals.set(band, { metres: total.metres + chunk.metres, steps: total.steps + steps });
    }
    chunk = null;
  };

  measured.forEach((span) => {
    if (chunk && chunk.endMs !== span.startMs) close();
    chunk = chunk
      ? { ...chunk, endMs: span.endMs, metres: chunk.metres + span.metres }
      : { startMs: span.startMs, endMs: span.endMs, metres: span.metres };
    if ((chunk.endMs - chunk.startMs) / 1000 >= STRIDE_CHUNK_SECONDS) close();
  });
  // A trailing stretch shorter than a chunk is too short to time a cadence on.
};

export const computeSessionMetrics = (
  input: ComputationInput,
  {
    algorithm = 'filter',
    smooth = true,
    sensors = true,
    passesQuality = passesQualityGate,
  }: {
    algorithm?: MetricsAlgorithm;
    /** Filter only. Summary: forward + RTS smoother. Live HUD: forward pass only. */
    smooth?: boolean;
    /** Filter only. False reproduces v3: no ZUPT, no step bridging (Amendment 03 C2 / C3). */
    sensors?: boolean;
    /** v2 only. Defaults to the summary quality gate (≤10 m). */
    passesQuality?: (accuracyM: number | null) => boolean;
  } = {},
): ComputedSessionMetrics => {
  const segments = [...input.segments].sort((a, b) => a.segmentIndex - b.segmentIndex);
  const cornerPoints = input.corners
    ? [
        input.corners.end_a_corner_1,
        input.corners.end_a_corner_2,
        input.corners.end_b_corner_1,
        input.corners.end_b_corner_2,
      ]
    : [];
  const scale = scaleAtLatitude(
    cornerPoints.length > 0 ? centroidLatitude(cornerPoints) : (input.points[0]?.lat ?? 0),
  );
  const pitchLongAxisM = input.corners ? longAxisMetres(input.corners, scale) : null;
  const { bucket, boundaries } = resolveSpeedBands({
    playStructure: input.playStructure,
    pitchId: input.pitchId,
    longAxisM: pitchLongAxisM,
  });

  const segmentIds = new Set(segments.map((segment) => segment.id));
  const continuityFixCount = input.points.filter(
    (point) => segmentIds.has(point.segmentId) && passesContinuityGate(point.horizontalAccuracyM),
  ).length;

  const { spans, acceptedCount, speedSamples, stepResidualMetres, zuptFixCount, strideSamples } =
    algorithm === 'v2'
      ? buildV2Spans({ input, segmentIds, scale, passesQuality })
      : buildV3Spans({ input, segmentIds, scale, smooth, sensors });

  const distance = new Map<string, number>();
  const covered = new Map<string, number>();
  const zoneFloat = new Map<string, Record<ZoneName, number>>();
  const calorieFloat = new Map<string, number>();
  let usedOs = false;
  let usedDerived = false;
  let stepBridgedDistanceM = 0;

  const addStepMetres = (segmentId: string, metres: number) => {
    distance.set(segmentId, (distance.get(segmentId) ?? 0) + metres);
    stepBridgedDistanceM += metres;
    if (input.massKg != null) {
      // No speed of its own, so the distance-based estimate (0.5 §5.1), not zone-weighted MET.
      calorieFloat.set(
        segmentId,
        (calorieFloat.get(segmentId) ?? 0) +
          (metres / 1000) * input.massKg * CALORIE_KCAL_PER_KG_PER_KM,
      );
    }
  };

  segments.forEach((segment) => {
    distance.set(segment.id, 0);
    covered.set(segment.id, 0);
    zoneFloat.set(segment.id, emptyZones());
    calorieFloat.set(segment.id, 0);
  });

  spans.forEach((span) => {
    if (!distance.has(span.segmentId)) return;
    if (span.fromSteps) {
      addStepMetres(span.segmentId, span.metres);
      return;
    }
    const dt = (span.endMs - span.startMs) / 1000;
    distance.set(span.segmentId, (distance.get(span.segmentId) ?? 0) + span.metres);
    covered.set(span.segmentId, (covered.get(span.segmentId) ?? 0) + dt);
    if (span.fromOs) usedOs = true;
    else if (span.speedKmh != null) usedDerived = true;

    if (span.speedKmh != null) {
      const zones = zoneFloat.get(span.segmentId) ?? emptyZones();
      zones[zoneForSpeed(span.speedKmh, boundaries)] += dt;
      zoneFloat.set(span.segmentId, zones);
      if (input.massKg != null) {
        calorieFloat.set(
          span.segmentId,
          (calorieFloat.get(span.segmentId) ?? 0) +
            kcalFromTime({ seconds: dt, met: metForSpeed(span.speedKmh), massKg: input.massKg }),
        );
      }
    }
  });

  stepResidualMetres.forEach((metres, segmentId) => {
    if (distance.has(segmentId)) addStepMetres(segmentId, metres);
  });

  const speedSource: SpeedSource = usedOs ? 'os' : usedDerived ? 'position_delta' : 'none';
  const suppressSpeed = speedSource === 'none';
  const sprintDrafts = suppressSpeed
    ? []
    : detectSprints({ spans, sprintMinKmh: boundaries.sprint });
  const sprints: ComputedSprint[] = sprintDrafts.map((sprint, index) => ({
    ...sprint,
    effortIndex: index + 1,
  }));

  const segmentRows: ComputedSegmentMetrics[] = segments.map((segment) => {
    const activeDurationSeconds = activeSecondsForSegment({ segment, pauses: input.pauses });
    const gapSeconds = Math.min(
      activeDurationSeconds,
      Math.max(0, Math.round(activeDurationSeconds - (covered.get(segment.id) ?? 0))),
    );
    const peak = suppressSpeed ? null : determineTopSpeedPeak(speedSamples.get(segment.id) ?? []);
    const derivedPeak = spans
      .filter(
        (span) =>
          span.segmentId === segment.id && span.speedKmh != null && !span.fromOs && !span.fromSteps,
      )
      .reduce<{ kmh: number; lat: number; lng: number } | null>((best, span) => {
        if (span.speedKmh == null) return best;
        if (best && span.speedKmh <= best.kmh) return best;
        return { kmh: span.speedKmh, lat: span.to.lat, lng: span.to.lng };
      }, null);
    const top =
      peak && peak.kmh > 0
        ? peak
        : speedSource === 'position_delta' && derivedPeak
          ? derivedPeak
          : null;
    const segmentSprints = sprints.filter((sprint) => sprint.segmentId === segment.id);
    const distanceM = distance.get(segment.id) ?? 0;
    // Under `none` the GPS spans carry no speed, so calorieFloat already holds only step metres.
    const caloriesKcal =
      input.massKg == null
        ? null
        : suppressSpeed
          ? Math.round((distanceM / 1000) * input.massKg * CALORIE_KCAL_PER_KG_PER_KM)
          : Math.round(calorieFloat.get(segment.id) ?? 0);

    return {
      segmentId: segment.id,
      segmentIndex: segment.segmentIndex,
      activeDurationSeconds,
      distanceM,
      gapSeconds,
      topSpeedKmh: suppressSpeed ? null : (top?.kmh ?? null),
      topSpeedLat: suppressSpeed ? null : (top?.lat ?? null),
      topSpeedLng: suppressSpeed ? null : (top?.lng ?? null),
      sprintCount: suppressSpeed ? 0 : segmentSprints.length,
      sprintDistanceM: suppressSpeed
        ? 0
        : segmentSprints.reduce((sum, sprint) => sum + sprint.distanceM, 0),
      zones: suppressSpeed ? emptyZones() : roundZones(zoneFloat.get(segment.id) ?? emptyZones()),
      caloriesKcal,
    };
  });

  const fastest = segmentRows.reduce<ComputedSegmentMetrics | null>((best, row) => {
    if (row.topSpeedKmh == null) return best;
    if (best?.topSpeedKmh == null || row.topSpeedKmh > best.topSpeedKmh) return row;
    return best;
  }, null);

  const activeDurationSeconds = segmentRows.reduce(
    (sum, row) => sum + row.activeDurationSeconds,
    0,
  );
  const gapSeconds = segmentRows.reduce((sum, row) => sum + row.gapSeconds, 0);
  const acceptedFixCount = segmentRows.reduce(
    (sum, row) => sum + (acceptedCount.get(row.segmentId) ?? 0),
    0,
  );
  const segmentSteps = segments
    .map((segment) => segment.stepCount)
    .filter((steps): steps is number => steps != null);

  return {
    activeDurationSeconds,
    distanceM: segmentRows.reduce((sum, row) => sum + row.distanceM, 0),
    topSpeedKmh: fastest?.topSpeedKmh ?? null,
    topSpeedLat: fastest?.topSpeedLat ?? null,
    topSpeedLng: fastest?.topSpeedLng ?? null,
    sprintCount: sprints.length,
    sprintDistanceM: sprints.reduce((sum, sprint) => sum + sprint.distanceM, 0),
    zones: sumZones(segmentRows.map((row) => row.zones)),
    caloriesKcal:
      input.massKg == null
        ? null
        : segmentRows.reduce((sum, row) => sum + (row.caloriesKcal ?? 0), 0),
    massKgAtComputation: input.massKg,
    speedSource,
    dataQuality: classifyQuality({
      gapSeconds,
      activeSeconds: activeDurationSeconds,
      acceptedFixCount,
    }),
    speedBandBucket: bucket,
    speedBandBoundaries: boundaries,
    pitchLongAxisM,
    acceptedFixCount,
    continuityFixCount,
    gapSeconds,
    stepCount: segmentSteps.length > 0 ? segmentSteps.reduce((sum, steps) => sum + steps, 0) : null,
    stepBridgedDistanceM,
    zuptFixCount,
    strideSamples,
    algorithmVersion:
      algorithm === 'v2'
        ? LEGACY_ALGORITHM_VERSION
        : sensors
          ? ALGORITHM_VERSION
          : FILTER_ONLY_ALGORITHM_VERSION,
    computedAt: input.computedAt ?? new Date().toISOString(),
    segments: segmentRows,
    sprints,
  };
};

/**
 * Doppler-integrated reference distance (Amendment 03 §2): Σ OS speed × dt between consecutive
 * continuity-grade fixes ≤ 5 s apart. Independent of position noise; logged, never stored as the
 * session's distance.
 */
export const dopplerReferenceDistanceM = (input: ComputationInput) => {
  const segmentIds = new Set(input.segments.map((segment) => segment.id));
  const fixes = input.points
    .filter(
      (point) =>
        segmentIds.has(point.segmentId) &&
        passesContinuityGate(point.horizontalAccuracyM) &&
        point.speedKmh != null,
    )
    .map((point) => ({ ...point, atMs: Date.parse(point.recordedAt) }))
    .sort((a, b) => a.atMs - b.atMs);
  let metres = 0;
  for (let index = 1; index < fixes.length; index += 1) {
    const previous = fixes[index - 1]!;
    const current = fixes[index]!;
    if (previous.segmentId !== current.segmentId) continue;
    const dt = (current.atMs - previous.atMs) / 1000;
    if (dt <= 0 || dt > GAP_BRIDGE_MAX_SECONDS) continue;
    metres += (((previous.speedKmh ?? 0) + (current.speedKmh ?? 0)) / 2 / 3.6) * dt;
  }
  return metres;
};

/**
 * Step-implied distance (Amendment 03 C3.2): Σ segment steps × the player's stride at that
 * segment's mean cadence. Independent of GPS entirely; a cross-check, never the stored distance.
 * Null when no segment had a pedometer reading.
 */
export const stepImpliedDistanceM = (input: ComputationInput) => {
  const stride = input.stride ?? DEFAULT_STRIDE;
  const counted = input.segments.filter((segment) => segment.stepCount != null);
  if (counted.length === 0) return null;
  return counted.reduce(
    (sum, segment) =>
      sum +
      stepMetres({
        steps: segment.stepCount ?? 0,
        seconds: activeSecondsForSegment({ segment, pauses: input.pauses }),
        stride,
      }),
    0,
  );
};
