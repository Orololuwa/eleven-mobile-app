import { withDb } from '../tracking/db';
import { STRIDE_LEARN_SESSIONS, STRIDE_MIN_SESSION_STEPS } from './constants';
import { DEFAULT_STRIDE, strideFromSamples, type StrideBand, type StrideEstimate } from './steps';
import type { StrideSample } from './types';

/**
 * Amendment 03 C3.3 — per-player stride, device-local. One row per session and band, so a
 * recomputed session replaces its own evidence instead of counting twice.
 */
export const saveStrideSamples = async ({
  sessionId,
  userId,
  samples,
  recordedAt,
}: {
  sessionId: string;
  userId: string;
  samples: StrideSample[];
  recordedAt: string;
}) => {
  const usable = samples.filter((sample) => sample.steps >= STRIDE_MIN_SESSION_STEPS);
  await withDb(async (db) => {
    await db.runAsync(`DELETE FROM stride_samples WHERE session_id = ?`, [sessionId]);
    for (const sample of usable) {
      await db.runAsync(
        `INSERT OR REPLACE INTO stride_samples (session_id, user_id, band, metres, steps, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, userId, sample.band, sample.metres, Math.round(sample.steps), recordedAt],
      );
    }
  });
  return usable;
};

/** Removes a session's evidence — it was recomputed and no longer rates clean. */
export const clearStrideSamples = async (sessionId: string) => {
  await withDb((db) => db.runAsync(`DELETE FROM stride_samples WHERE session_id = ?`, [sessionId]));
};

export const getStrideEstimate = async (userId: string | null): Promise<StrideEstimate> => {
  if (!userId) return DEFAULT_STRIDE;
  const rows = await withDb((db) =>
    db.getAllAsync<{ band: StrideBand; metres: number; steps: number }>(
      `SELECT band, metres, steps FROM (
         SELECT band, metres, steps,
           ROW_NUMBER() OVER (PARTITION BY band ORDER BY recorded_at DESC) AS recency
         FROM stride_samples WHERE user_id = ?
       ) WHERE recency <= ?`,
      [userId, STRIDE_LEARN_SESSIONS],
    ),
  );
  return strideFromSamples(rows);
};
