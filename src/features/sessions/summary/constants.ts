/** Bump when the same trace would store different numbers. See spec §6.2. */
export const ALGORITHM_VERSION = 'v3';

/** The previous pipeline, still computed alongside v3 for comparison (Amendment 03 §4). */
export const LEGACY_ALGORITHM_VERSION = 'v2';

/**
 * Amendment 03 §4 flag: at session end also compute v2 and the Doppler-integrated reference, store
 * them in `metrics_comparisons` and log the difference. Stored metrics are v3 either way.
 */
export const METRICS_COMPARISON_ENABLED = true;

/**
 * v2 only — and the live HUD's "measuring now" signal, which still asks whether two fixes are close
 * enough to bridge. v3 distance has no time bridge; see GAP_POSITION_SIGMA_MAX_M.
 */
export const GAP_BRIDGE_MAX_SECONDS = 5;

// --- v3 motion filter (Amendment 03 C1 / C4 / C5) -------------------------------------------

/**
 * σ_a, unmodelled acceleration (m/s²). Low is safe once Doppler speed is fused: in replay a 0 → 6 m/s
 * sprint reads 6.05 m/s two seconds after the ramp ends, while 60 s standing in 5 m scatter adds
 * ~3 m live / ~7 m summary instead of 539 m. Spec range 0.5–1.0.
 */
export const FILTER_ACCEL_SIGMA_MPS2 = 0.75;
export const FILTER_POSITION_SIGMA_FLOOR_M = 1;
export const FILTER_SPEED_SIGMA_FLOOR_MPS = 0.2;
/** Fix with a speed but no speed accuracy. */
export const FILTER_SPEED_SIGMA_DEFAULT_MPS = 1;
/** C4: fused fixes report 6–7 m indoors while being much worse. */
export const FILTER_FUSED_POSITION_SIGMA_FLOOR_M = 10;
/** C4: Play Services reports a flat 1.5 m/s speed accuracy indoors (21 Oct). */
export const FILTER_FUSED_SPEED_SIGMA_FLOOR_MPS = 2;
/** Position outlier test, Mahalanobis² at 2 dof / 99.9 %. Subsumes 0.4.2 F3's position check. */
export const FILTER_POSITION_INNOVATION_GATE = 13.8;
export const FILTER_GATE_WARMUP_UPDATES = 5;
/** After this many consecutive gated-out fixes the next is accepted (re-anchor, not lock-out). */
export const FILTER_GATE_LOCKOUT_FIXES = 3;
export const FILTER_DIRECTION_MIN_SPEED_MPS = 0.5;
/**
 * Doppler speed is applied along the heading once estimated speed ≥ this × its spread (≈ 50°).
 * 2.0 waited too long: positions fell behind and the catch-up overshot a steady 7.2 km/h walk to
 * 7.39. 1.2 reads 7.23 and picks up a sprint two fixes sooner; the lock-out guard covers a bad guess.
 */
export const FILTER_HEADING_CONFIDENCE_RATIO = 1.2;
/** Doppler at or below this observes v = 0. The chip pins speed to exactly 0 when static. */
export const FILTER_STATIONARY_SPEED_MPS = 0.3;

/**
 * Replaces the 5 s bridge: an interval counts toward distance while the predicted position σ at
 * its end stays under this. ≈ 5 s of prediction at a steady jog, less mid-sprint.
 */
export const GAP_POSITION_SIGMA_MAX_M = 12;

/** Longer than this between fixes starts a fresh filter run — the old state means nothing now. */
export const FILTER_RESET_GAP_SECONDS = 30;
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
