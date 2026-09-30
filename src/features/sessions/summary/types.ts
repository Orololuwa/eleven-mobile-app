import type { PlayStructure } from '../types';
import type { PauseReason } from '../tracking/types';
import type { LatLng } from '../tracking/geodesic';
import type { SpeedBandBoundaries, SpeedBandBucket, ZoneName } from './speed-bands';

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
};

export type ComputationSegment = {
  id: string;
  segmentIndex: number;
  startedAt: string;
  endedAt: string;
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
  computedAt?: string;
};

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
  acceptedFixCount: number;
  gapSeconds: number;
  algorithmVersion: string;
  computedAt: string;
  segments: ComputedSegmentMetrics[];
  sprints: ComputedSprint[];
};
