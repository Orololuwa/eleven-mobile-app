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
