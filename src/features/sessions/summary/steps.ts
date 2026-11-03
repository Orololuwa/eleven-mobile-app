/**
 * Amendment 03 C3 — pedometer helpers shared by the location task (segment step totals), the
 * summary and the live pass. Pure: no React Native, no SQLite.
 *
 * Step counts arrive as the sensor's cumulative counter (Android TYPE_STEP_COUNTER counts since
 * boot; the TYPE_STEP_DETECTOR fallback counts since the session subscribed). Only differences
 * between two readings mean anything.
 */
import {
  STEP_MAX_RATE_PER_S,
  STRIDE_DEFAULT_RUN_M,
  STRIDE_DEFAULT_WALK_M,
  STRIDE_MAX_M,
  STRIDE_MIN_LEARNED_STEPS,
  STRIDE_MIN_M,
  STRIDE_RUN_CADENCE_SPM,
} from './constants';

export type StrideBand = 'walk' | 'run';

/** Metres per step for each cadence band; `learned` false means the population default (§5). */
export type StrideEstimate = {
  walkM: number;
  runM: number;
  walkLearned: boolean;
  runLearned: boolean;
};

export const DEFAULT_STRIDE: StrideEstimate = {
  walkM: STRIDE_DEFAULT_WALK_M,
  runM: STRIDE_DEFAULT_RUN_M,
  walkLearned: false,
  runLearned: false,
};

/**
 * Steps between two counter readings, or null when they cannot be compared: a reading is missing,
 * the counter went backwards (reboot, or the detector fallback re-subscribed), or it climbed faster
 * than anyone runs.
 */
export const stepDelta = ({
  fromCount,
  fromMs,
  toCount,
  toMs,
}: {
  fromCount: number | null | undefined;
  fromMs: number;
  toCount: number | null | undefined;
  toMs: number;
}): number | null => {
  if (fromCount == null || toCount == null) return null;
  const steps = toCount - fromCount;
  if (steps < 0) return null;
  // Slack of a few seconds: the counter reports in bursts, not per step.
  const ceiling = (Math.max(0, toMs - fromMs) / 1000 + 5) * STEP_MAX_RATE_PER_S;
  return steps > ceiling ? null : steps;
};

export const strideBand = (cadenceSpm: number): StrideBand =>
  cadenceSpm >= STRIDE_RUN_CADENCE_SPM ? 'run' : 'walk';

/** Metres for `steps` taken over `seconds`, at the stride for that cadence. */
export const stepMetres = ({
  steps,
  seconds,
  stride,
}: {
  steps: number;
  seconds: number;
  stride: StrideEstimate;
}) => {
  if (steps <= 0) return 0;
  const cadence = seconds > 0 ? (steps / seconds) * 60 : 0;
  return steps * (strideBand(cadence) === 'run' ? stride.runM : stride.walkM);
};

/**
 * C3.3: the player's stride per band from their most recent clean sessions — Σ metres ÷ Σ steps,
 * clamped. A band with too few steps behind it keeps the population default.
 */
export const strideFromSamples = (
  samples: { band: StrideBand; metres: number; steps: number }[],
): StrideEstimate => {
  const learn = (band: StrideBand, fallback: number) => {
    const rows = samples.filter((sample) => sample.band === band);
    const steps = rows.reduce((sum, row) => sum + row.steps, 0);
    const metres = rows.reduce((sum, row) => sum + row.metres, 0);
    if (steps < STRIDE_MIN_LEARNED_STEPS) return { metres: fallback, learned: false };
    return {
      metres: Math.min(STRIDE_MAX_M, Math.max(STRIDE_MIN_M, metres / steps)),
      learned: true,
    };
  };
  const walk = learn('walk', DEFAULT_STRIDE.walkM);
  const run = learn('run', DEFAULT_STRIDE.runM);
  return {
    walkM: walk.metres,
    runM: run.metres,
    walkLearned: walk.learned,
    runLearned: run.learned,
  };
};
