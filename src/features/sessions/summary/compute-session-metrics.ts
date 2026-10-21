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
} from './constants';
import {
  filterRun,
  positionSigmaOf,
  smoothRun,
  speedOf,
  speedSigmaOf,
  type FilterFix,
  type FilterTuning,
} from './motion-filter';
import { metForSpeed, resolveSpeedBands, zoneForSpeed, type ZoneName } from './speed-bands';
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
  ZoneSeconds,
} from './types';

type AcceptedFix = ComputationPoint & { atMs: number; osSpeedKmh: number | null };

type BridgedSpan = {
  segmentId: string;
  startMs: number;
  endMs: number;
  metres: number;
  speedKmh: number | null;
  fromOs: boolean;
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

const pauseOverlapSec = ({
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

const activeSecondsForSegment = ({
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

/** 0.5 §3.9. The live HUD reads this through `computeSessionMetrics` too — never a second copy. */
const classifyQuality = ({
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

export type MetricsAlgorithm = 'v2' | 'v3';

type SpeedSample = {
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
};

const FILTER_TUNING: FilterTuning = {
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
    speedSamples.set(fix.segmentId, [
      ...(speedSamples.get(fix.segmentId) ?? []),
      toSpeedSample(fix),
    ]);
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
  return { spans, acceptedCount, speedSamples };
};

/**
 * v3 (Amendment 03): one Kalman filter per segment fusing position and Doppler speed. Distance is
 * the integral of filtered speed; an interval counts while the predicted position σ stays under
 * GAP_POSITION_SIGMA_MAX_M (replaces the 5 s bridge). `smooth` adds the RTS backward pass — the
 * summary has the whole session, the live HUD does not.
 */
const buildV3Spans = ({
  input,
  segmentIds,
  scale,
  smooth,
}: {
  input: ComputationInput;
  segmentIds: Set<string>;
  scale: DegreeScale;
  smooth: boolean;
}): SpanBuild => {
  const admitted = input.points
    .filter(
      (point) => segmentIds.has(point.segmentId) && passesContinuityGate(point.horizontalAccuracyM),
    )
    .map((point) => ({ ...point, atMs: Date.parse(point.recordedAt) }))
    .sort((a, b) => a.atMs - b.atMs);

  const spans: BridgedSpan[] = [];
  const acceptedCount = new Map<string, number>();
  const speedSamples = new Map<string, SpeedSample[]>();
  const origin = admitted[0];
  if (!origin) return { spans, acceptedCount, speedSamples };

  const toFix = (point: (typeof admitted)[number]): FilterFix => ({
    tMs: point.atMs,
    x: (point.lng - origin.lng) * scale.mPerDegLng,
    y: (point.lat - origin.lat) * scale.mPerDegLat,
    horizontalAccuracyM: point.horizontalAccuracyM ?? Number.POSITIVE_INFINITY,
    speedMps:
      point.speedKmh != null && point.speedKmh >= 0 && point.speedKmh < TOP_SPEED_CEILING_KMH
        ? point.speedKmh / 3.6
        : null,
    speedAccuracyMps: point.speedAccuracyMps,
    provider: point.provider ?? null,
  });
  const toLatLng = (state: number[]): LatLng => ({
    lat: origin.lat + state[1]! / scale.mPerDegLat,
    lng: origin.lng + state[0]! / scale.mPerDegLng,
  });

  const bySegment = new Map<string, typeof admitted>();
  admitted.forEach((point) => {
    bySegment.set(point.segmentId, [...(bySegment.get(point.segmentId) ?? []), point]);
  });

  bySegment.forEach((points, segmentId) => {
    const manualPauses = input.pauses.filter(
      (pause) => pause.segmentId === segmentId && pause.reason === 'manual',
    );
    // A long silence or a manual pause starts a fresh run: the old state says nothing about now.
    const runs: (typeof admitted)[] = [];
    points.forEach((point, index) => {
      const previous = points[index - 1];
      const breaks =
        !previous ||
        (point.atMs - previous.atMs) / 1000 > FILTER_RESET_GAP_SECONDS ||
        pauseOverlapSec({ startMs: previous.atMs, endMs: point.atMs, pauses: manualPauses }) > 0;
      if (breaks) runs.push([point]);
      else runs[runs.length - 1]!.push(point);
    });

    runs.forEach((run) => {
      const steps = filterRun(run.map(toFix), FILTER_TUNING);
      const states = smooth
        ? smoothRun(steps)
        : steps.map((step) => ({ x: step.xFilt, p: step.pFilt }));

      steps.forEach((step, index) => {
        const state = states[index]!;
        if (step.positionAccepted) {
          acceptedCount.set(segmentId, (acceptedCount.get(segmentId) ?? 0) + 1);
        }
        const at = toLatLng(state.x);
        speedSamples.set(segmentId, [
          ...(speedSamples.get(segmentId) ?? []),
          {
            recorded_at: iso(step.tMs),
            lat: at.lat,
            lng: at.lng,
            speed_kmh: speedOf(state.x) * 3.6,
            speed_accuracy_mps: speedSigmaOf(state.x, state.p),
            horizontal_accuracy_m: positionSigmaOf(state.p),
          },
        ]);

        const previousStep = steps[index - 1];
        const previousState = states[index - 1];
        if (!previousStep || !previousState) return;
        // Uncertainty bound, not a time bound: stop claiming distance once we no longer know
        // where the player is.
        if (positionSigmaOf(step.pPred) > GAP_POSITION_SIGMA_MAX_M) return;
        const metres = ((speedOf(previousState.x) + speedOf(state.x)) / 2) * step.dt;
        const meanKmh = (metres / step.dt) * 3.6;
        if (meanKmh >= TOP_SPEED_CEILING_KMH) return;
        spans.push({
          segmentId,
          startMs: previousStep.tMs,
          endMs: step.tMs,
          metres,
          speedKmh: meanKmh,
          fromOs: step.speedUsed || previousStep.speedUsed,
          from: toLatLng(previousState.x),
          to: at,
        });
      });
    });
  });

  spans.sort((a, b) => a.startMs - b.startMs);
  return { spans, acceptedCount, speedSamples };
};

export const computeSessionMetrics = (
  input: ComputationInput,
  {
    algorithm = 'v3',
    smooth = true,
    passesQuality = passesQualityGate,
  }: {
    algorithm?: MetricsAlgorithm;
    /** v3 only. Summary: forward + RTS smoother. Live HUD: forward pass only. */
    smooth?: boolean;
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

  const { spans, acceptedCount, speedSamples } =
    algorithm === 'v2'
      ? buildV2Spans({ input, segmentIds, scale, passesQuality })
      : buildV3Spans({ input, segmentIds, scale, smooth });

  const distance = new Map<string, number>();
  const covered = new Map<string, number>();
  const zoneFloat = new Map<string, Record<ZoneName, number>>();
  const calorieFloat = new Map<string, number>();
  let usedOs = false;
  let usedDerived = false;

  segments.forEach((segment) => {
    distance.set(segment.id, 0);
    covered.set(segment.id, 0);
    zoneFloat.set(segment.id, emptyZones());
    calorieFloat.set(segment.id, 0);
  });

  spans.forEach((span) => {
    if (!distance.has(span.segmentId)) return;
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
      .filter((span) => span.segmentId === segment.id && span.speedKmh != null && !span.fromOs)
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
    algorithmVersion: algorithm === 'v2' ? LEGACY_ALGORITHM_VERSION : ALGORITHM_VERSION,
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
