/**
 * Accepted-fix horizontal accuracy threshold (metres).
 * 40m is still usable for pitch tracking; 20m was rejecting most Android
 * pocket/indoor-edge fixes and triggering permanent gps_loss.
 */
export const ACCEPTED_FIX_ACCURACY_M = 40;

/** No accepted fix for this long (after the first good lock) → auto-pause (gps_loss). */
export const GPS_LOSS_PAUSE_MS = 30_000;

/** Cooldown after auto-resume before another auto-pause can fire. */
export const AUTO_RESUME_COOLDOWN_MS = 10_000;

/** Push distance / top speed into notification & Live Activity. */
export const INDICATOR_UPDATE_INTERVAL_MS = 5_000;

/** High-activity speed threshold for downsampling (km/h). */
export const DOWNSAMPLE_HIGH_SPEED_KMH = 12;

/** Speed jump within one sample that keeps a fix (m/s). */
export const DOWNSAMPLE_SPEED_JUMP_MS = 1.5;

/** Low-activity thinning interval (ms). */
export const DOWNSAMPLE_LOW_ACTIVITY_INTERVAL_MS = 4_000;

/** Initial sync retry delay; doubles up to cap. */
export const SYNC_RETRY_INITIAL_MS = 5_000;

/** Maximum sync retry backoff. */
export const SYNC_RETRY_MAX_MS = 5 * 60_000;

/** Track-points upload chunk size. */
export const TRACK_POINTS_CHUNK_SIZE = 500;

/** Hold-to-confirm duration (ms). Pause, end activity, and end session all use this. */
export const HOLD_CONFIRM_MS = 1_500;

export const HOLD_CONFIRM_SECONDS = HOLD_CONFIRM_MS / 1_000;

export const LOCATION_TASK_NAME = 'eleven-location-tracking';

export const ANDROID_FGS_TITLE = 'Eleven — tracking your session';

/** F1 — max OS speed accuracy (m/s). Null speed_accuracy_mps skips F1. */
export const SPEED_ACCURACY_MAX_MPS = 2.0;

/** F2 — physically implausible top-speed ceiling (km/h). Reject at or above. */
export const TOP_SPEED_CEILING_KMH = 40;

/** F3 — reject when position-delta speed is below this fraction of averaged OS speed. */
export const SPEED_CROSSCHECK_MIN_RATIO = 0.5;

/** F4 — sustained peak must span at least this duration (ms). */
export const TOP_SPEED_SUSTAINED_MS = 3_000;

/** F4 — sustained peak must include at least this many candidate fixes. */
export const TOP_SPEED_MIN_FIXES = 2;

/** F4 — ( |reading − anchor| / anchor ) must stay within this band. */
export const TOP_SPEED_BAND_RATIO = 0.15;
