import type { PlayStructure } from '../types';
import { LONG_AXIS_MAX_M, LONG_AXIS_MIN_M } from './constants';

export type SpeedBandBucket = 'futsal' | 'small' | 'mid' | 'full';

/** Kilometre-per-hour thresholds, matching `SpeedBandBoundaries` on the API. */
export type SpeedBandBoundaries = {
  walk: number;
  jog: number;
  run: number;
  high_run: number;
  sprint: number;
};

export type ZoneName = 'walk' | 'jog' | 'run' | 'high_run' | 'sprint';

const bands = (jog: number, run: number, sprint: number): SpeedBandBoundaries => ({
  walk: 7,
  jog,
  run,
  high_run: sprint,
  sprint,
});

export const SPEED_BANDS: Record<SpeedBandBucket, SpeedBandBoundaries> = {
  futsal: bands(9, 12, 15),
  small: bands(10, 14, 17),
  mid: bands(11, 15, 18),
  full: bands(12, 16, 20),
};

export const BAND_BUCKET_LABEL: Record<SpeedBandBucket, string> = {
  futsal: 'FUTSAL BANDS',
  small: '7-A-SIDE BANDS',
  mid: '9-A-SIDE BANDS',
  full: '11-A-SIDE BANDS',
};

export const BAND_SIZE_LABEL: Record<SpeedBandBucket, string> = {
  futsal: '5-A-SIDE',
  small: '7-A-SIDE',
  mid: '9-A-SIDE',
  full: '11-A-SIDE',
};

export const bucketForLongAxis = (longAxisM: number): SpeedBandBucket => {
  if (longAxisM < 45) return 'futsal';
  if (longAxisM < 65) return 'small';
  if (longAxisM < 85) return 'mid';
  return 'full';
};

export const resolveSpeedBands = ({
  playStructure,
  pitchId,
  longAxisM,
}: {
  playStructure: PlayStructure;
  pitchId: string | null;
  longAxisM: number | null;
}): { bucket: SpeedBandBucket; boundaries: SpeedBandBoundaries } => {
  const usable =
    pitchId != null &&
    playStructure !== 'training_activities' &&
    longAxisM != null &&
    longAxisM >= LONG_AXIS_MIN_M &&
    longAxisM <= LONG_AXIS_MAX_M;

  const bucket = usable && longAxisM != null ? bucketForLongAxis(longAxisM) : 'full';
  return { bucket, boundaries: SPEED_BANDS[bucket] };
};

export const zoneForSpeed = (kmh: number, boundaries: SpeedBandBoundaries): ZoneName => {
  if (kmh < boundaries.walk) return 'walk';
  if (kmh < boundaries.jog) return 'jog';
  if (kmh < boundaries.run) return 'run';
  if (kmh < boundaries.sprint) return 'high_run';
  return 'sprint';
};

export const metForSpeed = (kmh: number) => {
  if (kmh < 5) return 2.5;
  if (kmh < 7) return 3.5;
  if (kmh < 10) return 8;
  if (kmh < 13) return 11;
  if (kmh < 16) return 13;
  if (kmh < 19) return 15.5;
  return 19;
};
