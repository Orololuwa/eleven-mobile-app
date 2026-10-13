/** Bump when the same trace would store different numbers. See spec §6.2. */
export const ALGORITHM_VERSION = 'v2';

export const GAP_BRIDGE_MAX_SECONDS = 5;
export const SPRINT_MIN_SECONDS = 1;
export const SPRINT_MIN_FIXES = 2;
export const SPRINT_MIN_DISPLACEMENT_M = 5;
/** A single ~1 Hz sample below the line is noise, so 1.0 s still merges. */
export const SPRINT_MERGE_GAP_SECONDS = 1;
export const SPRINT_MERGE_CAP_SECONDS = 2;

export const LONG_AXIS_MIN_M = 15;
export const LONG_AXIS_MAX_M = 130;

/** Gap = active time not covered by bridged quality-gate fixes. Retune with QUALITY_FIX_ACCURACY_M. */
export const QUALITY_GOOD_GAP = 0.05;
export const QUALITY_INSUFFICIENT_GAP = 0.25;
/** Minimum quality-gate fixes for a session to report anything. */
export const QUALITY_MIN_FIXES = 120;
export const QUALITY_MIN_ACTIVE_SECONDS = 120;

export const CALORIE_KCAL_PER_KG_PER_KM = 1;
export const WEIGHT_STALE_DAYS = 90;

export const MET_BINS: { maxKmh: number; met: number }[] = [
  { maxKmh: 5, met: 2.5 },
  { maxKmh: 7, met: 3.5 },
  { maxKmh: 10, met: 8 },
  { maxKmh: 13, met: 11 },
  { maxKmh: 16, met: 13 },
  { maxKmh: 19, met: 15.5 },
  { maxKmh: Number.POSITIVE_INFINITY, met: 19 },
];
