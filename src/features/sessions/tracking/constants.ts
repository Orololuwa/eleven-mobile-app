/**
 * Continuity gate (metres, inclusive). A fix within it proves tracking is alive: it resets the
 * GPS-loss timer and is stored in the trace. Generous on purpose — a false signal-loss pause is
 * worse than a marginal fix.
 */
export const CONTINUITY_FIX_ACCURACY_M = 50;

/**
 * Quality gate (metres, inclusive). Only fixes within it feed **summary** distance, speed, sprints,
 * and zones. Coupled to the summary's gap-based data quality: time covered only by fixes outside it
 * is gap.
 */
export const QUALITY_FIX_ACCURACY_M = 10;

/**
 * Live HUD gate (metres, inclusive). Matches continuity so every stored fix can feed live distance
 * and "measuring now". Summary metrics stay on `QUALITY_FIX_ACCURACY_M`.
 */
export const LIVE_QUALITY_FIX_ACCURACY_M = CONTINUITY_FIX_ACCURACY_M;

/** No continuity-passing fix for this long (after the first lock) → auto-pause (gps_loss). */
export const GPS_LOSS_PAUSE_MS = 30_000;

/**
 * Until the session's first bridgeable pair of quality fixes, an `insufficient` live readout reads as settling rather
 * than poor signal, for at most this much active time: a cold GPS start takes 30–40 s to reach the
 * quality gate. Presentation only; suppression is unchanged.
 */
export const LIVE_SIGNAL_SETTLE_SECONDS = 60;

/** Cooldown after auto-resume before another auto-pause can fire. */
export const AUTO_RESUME_COOLDOWN_MS = 10_000;

/** Push distance / top speed into notification & Live Activity. */
export const INDICATOR_UPDATE_INTERVAL_MS = 5_000;

/** Location task recomputes the live snapshot at most this often while the HUD is on screen. */
export const LIVE_SNAPSHOT_ACTIVE_INTERVAL_MS = 1_000;

/** …and this often while backgrounded / locked (only the notification reads it then). */
export const LIVE_SNAPSHOT_BACKGROUND_INTERVAL_MS = INDICATOR_UPDATE_INTERVAL_MS;

/** HUD recomputes itself when the persisted snapshot is older than this (task idle or frozen). */
export const LIVE_SNAPSHOT_STALE_MS = 2_500;

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

/** Poll cadence while a session is live — assert registration and recent fix delivery. */
export const LOCATION_WATCHDOG_INTERVAL_MS = 10_000;

/** No OS fix delivered for this long → treat as registration dropout (re-register / offline). */
export const LOCATION_FIX_STALE_MS = 15_000;

export const ANDROID_FGS_TITLE = 'Eleven — tracking your session';

/** F1 — max OS speed accuracy (m/s). Null speed_accuracy_mps skips F1. */
export const SPEED_ACCURACY_MAX_MPS = 2.0;

/** F2 — physically implausible top-speed ceiling (km/h). Reject at or above. */
export const TOP_SPEED_CEILING_KMH = 40;

/**
 * F3 — reject when position-delta speed is below this fraction of averaged OS speed, or above its
 * reciprocal (a position jump). One ratio tunes both sides.
 */
export const SPEED_CROSSCHECK_MIN_RATIO = 0.5;

/** F4 — sustained peak must span at least this duration (ms). */
export const TOP_SPEED_SUSTAINED_MS = 3_000;

/** F4 — sustained peak must include at least this many candidate fixes. */
export const TOP_SPEED_MIN_FIXES = 2;

/** F4 — ( |reading − anchor| / anchor ) must stay within this band. */
export const TOP_SPEED_BAND_RATIO = 0.15;
