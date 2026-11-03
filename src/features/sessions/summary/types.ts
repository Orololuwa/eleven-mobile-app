import type { PlayStructure } from '../types';
import type { PauseReason } from '../tracking/types';
import type { LatLng } from '../tracking/geodesic';
import type { SpeedBandBoundaries, SpeedBandBucket, ZoneName } from './speed-bands';
import type { StrideBand, StrideEstimate } from './steps';

export type SpeedSource = 'os' | 'position_delta' | 'none';

export type DataQuality = 'good' | 'estimated' | 'insufficient';

export type ComputationPoint = {
  segmentId: string;
  recordedAt: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  speedAccuracyMps: number | null;
  horizontalAccuracyM: number | null;
  /** C4 provenance; null (pre-v3 points) is weighted as reported. */
  provider?: 'gps' | 'fused' | null;
  /** C3: cumulative step counter when the fix arrived (Android native). Only deltas mean anything. */
  stepCount?: number | null;
  /** C2: variance of |acceleration| since the previous fix, (m/s²)². Null without the sensor. */
  accelVariance?: number | null;
};

export type ComputationSegment = {
  id: string;
  segmentIndex: number;
  startedAt: string;
  endedAt: string;
  /** C3.1: steps counted during the segment (manual pauses excluded). Null without a pedometer. */
  stepCount?: number | null;
};

export type ComputationPause = {
  segmentId: string;
  reason: PauseReason;
  startedAt: string;
  endedAt: string;
};

export type ComputationInput = {
  playStructure: PlayStructure;
  pitchId: string | null;
  corners: {
    end_a_corner_1: LatLng;
    end_a_corner_2: LatLng;
    end_b_corner_1: LatLng;
    end_b_corner_2: LatLng;
  } | null;
  segments: ComputationSegment[];
  pauses: ComputationPause[];
  points: ComputationPoint[];
  massKg: number | null;
  /** C3.3: the player's learned stride; population defaults when absent. */
  stride?: StrideEstimate | null;
  computedAt?: string;
};

/** C3.3: GPS-measured metres and the steps taken over them, for one session and cadence band. */
export type StrideSample = { band: StrideBand; metres: number; steps: number };

export type ZoneSeconds = Record<ZoneName, number>;

export type ComputedSegmentMetrics = {
  segmentId: string;
  segmentIndex: number;
  activeDurationSeconds: number;
  distanceM: number;
  gapSeconds: number;
  topSpeedKmh: number | null;
  topSpeedLat: number | null;
  topSpeedLng: number | null;
  sprintCount: number;
  sprintDistanceM: number;
  zones: ZoneSeconds;
  caloriesKcal: number | null;
};

export type ComputedSprint = {
  segmentId: string;
  effortIndex: number;
  startedAt: string;
  endedAt: string;
  durationS: number;
  distanceM: number;
  peakSpeedKmh: number;
  peakLat: number | null;
  peakLng: number | null;
};

export type ComputedSessionMetrics = {
  activeDurationSeconds: number;
  distanceM: number;
  topSpeedKmh: number | null;
  topSpeedLat: number | null;
  topSpeedLng: number | null;
  sprintCount: number;
  sprintDistanceM: number;
  zones: ZoneSeconds;
  caloriesKcal: number | null;
  massKgAtComputation: number | null;
  speedSource: SpeedSource;
  dataQuality: DataQuality;
  speedBandBucket: SpeedBandBucket;
  speedBandBoundaries: SpeedBandBoundaries;
  pitchLongAxisM: number | null;
  /** Fixes that passed the quality gate. */
  acceptedFixCount: number;
  /** Fixes that passed the continuity gate. Non-binding sampling signal; not used to classify. */
  continuityFixCount: number;
  gapSeconds: number;
  /** C3.1: Σ segment step counts; null when no segment had a pedometer reading. */
  stepCount: number | null;
  /**
   * C3.4: the part of `distanceM` that came from steps × stride (GPS gaps and segments GPS never
   * covered), so a step-derived figure is never silently mixed into the GPS one.
   */
  stepBridgedDistanceM: number;
  /** C2: fixes at which the filter applied a zero-velocity update. */
  zuptFixCount: number;
  /** C3.3: calibration evidence for the player's stride. Not stored on the session. */
  strideSamples: StrideSample[];
  algorithmVersion: string;
  computedAt: string;
  segments: ComputedSegmentMetrics[];
  sprints: ComputedSprint[];
};
