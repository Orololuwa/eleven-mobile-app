/** Bump when the same trace would store different numbers. See spec §6.2. */
export const ALGORITHM_VERSION = 'v3.1';

/** The previous pipeline, still computed alongside v3 for comparison (Amendment 03 §4). */
export const LEGACY_ALGORITHM_VERSION = 'v2';

/** The filter without motion sensors (Amendment 03 phase 1) — `{ sensors: false }`, comparison only. */
export const FILTER_ONLY_ALGORITHM_VERSION = 'v3';

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

// --- v3.1 motion sensors (Amendment 03 C2 / C3) ---------------------------------------------

/**
 * C2 ZUPT: v = 0 observed with this σ (m/s) — near-certain, so velocity and distance stop. Only
 * applied when at least ZUPT_MIN_VOTES of the three stillness signals below agree.
 */
export const ZUPT_SPEED_SIGMA_MPS = 0.05;
export const ZUPT_MIN_VOTES = 2;
/** Doppler vote: every fix in the trailing window at or below this (m/s). Walking is ~1.2–1.5. */
export const ZUPT_DOPPLER_MAX_MPS = 0.5;
/** Window the Doppler and step votes look back over (s) — "sustained", not one quiet reading. */
export const ZUPT_SUSTAIN_SECONDS = 3;
/**
 * Accelerometer vote: variance of |a| over the interval since the previous fix, (m/s²)². Phone
 * held still or in a pocket of a standing player reads ~0.001–0.02; walking reads ≥ 0.5.
 */
export const ZUPT_ACCEL_VARIANCE_MAX = 0.1;
/**
 * Moving veto: at or above this the accelerometer says walking, and no ZUPT is applied whatever the
 * other two vote. Indoors the votes are not independent — the chip reports ~0 km/h and the step
 * counter can stay flat through stop-start walking (21 Oct party walk: counter silent, variance
 * 1–6) — so Doppler + steps would otherwise outvote a phone that is plainly moving. It only ever
 * blocks a ZUPT, never forces one. Walking reads ≥ 1; light handling on the spot ~0.1–0.5.
 */
export const ZUPT_ACCEL_MOVING_MIN = 0.5;

/**
 * C3 stride bands (steps / min). Below: walking stride; at or above: running stride. NRC's own
 * figures (0.92 m at 147 spm, 0.98 m at 134 spm) sit in the run band.
 */
export const STRIDE_RUN_CADENCE_SPM = 120;
/** Population defaults until the player has STRIDE_MIN_SESSION_STEPS of clean sessions (§5). */
export const STRIDE_DEFAULT_WALK_M = 0.7;
export const STRIDE_DEFAULT_RUN_M = 0.95;
/** Learned stride is clamped here — anything outside is a measurement problem, not a gait. */
export const STRIDE_MIN_M = 0.4;
export const STRIDE_MAX_M = 1.8;
/** C3.3: a band needs this many steps in one clean session before it teaches a stride. */
export const STRIDE_MIN_SESSION_STEPS = 150;
/** Steps in the band across learned sessions before the learned stride replaces the default. */
export const STRIDE_MIN_LEARNED_STEPS = 300;
/** Learned stride averages this many of the player's most recent clean sessions per band. */
export const STRIDE_LEARN_SESSIONS = 10;
/** Calibration chunks: contiguous GPS-measured time is cut into windows this long (s). */
export const STRIDE_CHUNK_SECONDS = 10;
/** Faster than this between two readings is a counter fault or reset, not running (steps / s). */
export const STEP_MAX_RATE_PER_S = 5;
/** Steps outside fix coverage below this are counter latency, not movement. */
export const STEP_RESIDUAL_MIN_STEPS = 10;
/** C3.2: step-implied distance this far from GPS distance (either way) flags the session. */
export const STEP_CROSSCHECK_MAX_DIVERGENCE = 0.25;
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
