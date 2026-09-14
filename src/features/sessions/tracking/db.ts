import * as SQLite from 'expo-sqlite';
import type { PitchRead } from '@/features/pitches/types';
import type { ActivityKind, SessionRead, SessionStartOut } from '../types';
import { normalizePlayStructure } from '../segment-display';
import { createTrackingId } from './id';
import type {
  BackgroundPermission,
  StoredPitchCorners,
  SyncStatus,
  TrackingPauseRow,
  TrackingPointRow,
  TrackingSegmentRow,
  TrackingSessionRow,
  TrackingStatus,
} from './types';
import { serializeTrainingActivityOptions } from './types';

const DB_NAME = 'eleven-tracking.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const addColumnIfMissing = async (
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
) => {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (rows.some((row) => row.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
};

const migrateTrackingSchema = async (db: SQLite.SQLiteDatabase) => {
  await addColumnIfMissing(db, 'tracking_sessions', 'extra_time_enabled', 'INTEGER');
  await addColumnIfMissing(
    db,
    'tracking_sessions',
    'planned_extra_time_segment_length_minutes',
    'INTEGER',
  );
  await addColumnIfMissing(db, 'tracking_sessions', 'training_activity_options', 'TEXT');
  await addColumnIfMissing(db, 'tracking_segments', 'activity_kind', 'TEXT');
  await addColumnIfMissing(db, 'tracking_points', 'speed_accuracy_mps', 'REAL');
};

const getDb = () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS tracking_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          session_type TEXT NOT NULL,
          play_structure TEXT NOT NULL,
          planned_segment_length_minutes INTEGER,
          extra_time_enabled INTEGER,
          planned_extra_time_segment_length_minutes INTEGER,
          training_activity_options TEXT,
          pitch_id TEXT,
          pitch_name TEXT,
          end_a_corner_1_lat REAL,
          end_a_corner_1_lng REAL,
          end_a_corner_2_lat REAL,
          end_a_corner_2_lng REAL,
          end_b_corner_1_lat REAL,
          end_b_corner_1_lng REAL,
          end_b_corner_2_lat REAL,
          end_b_corner_2_lng REAL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_attempts INTEGER NOT NULL DEFAULT 0,
          last_sync_attempt_at TEXT,
          tracking_status TEXT NOT NULL DEFAULT 'live',
          last_accepted_fix_at TEXT,
          auto_resume_cooldown_until TEXT,
          background_permission TEXT NOT NULL DEFAULT 'when_in_use',
          live_activity_id TEXT,
          next_sequence_index INTEGER NOT NULL DEFAULT 0,
          segment_clock_origin_ms INTEGER NOT NULL DEFAULT 0,
          current_segment_id TEXT,
          gps_search_started_at TEXT
        );
        CREATE TABLE IF NOT EXISTS tracking_segments (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          segment_index INTEGER NOT NULL,
          attack_direction TEXT,
          activity_kind TEXT,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          FOREIGN KEY (session_id) REFERENCES tracking_sessions(id)
        );
        CREATE TABLE IF NOT EXISTS tracking_pauses (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          segment_id TEXT,
          reason TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          FOREIGN KEY (session_id) REFERENCES tracking_sessions(id)
        );
        CREATE TABLE IF NOT EXISTS tracking_points (
          id TEXT PRIMARY KEY NOT NULL,
          session_id TEXT NOT NULL,
          segment_id TEXT,
          sequence_index INTEGER NOT NULL,
          recorded_at TEXT NOT NULL,
          lat REAL NOT NULL,
          lng REAL NOT NULL,
          speed_kmh REAL,
          speed_accuracy_mps REAL,
          horizontal_accuracy_m REAL,
          FOREIGN KEY (session_id) REFERENCES tracking_sessions(id)
        );
        CREATE INDEX IF NOT EXISTS idx_tracking_points_session ON tracking_points(session_id, sequence_index);
        CREATE INDEX IF NOT EXISTS idx_tracking_pauses_session ON tracking_pauses(session_id);
        CREATE INDEX IF NOT EXISTS idx_tracking_segments_session ON tracking_segments(session_id);
      `);
      await migrateTrackingSchema(db);
      return db;
    });
  }
  return dbPromise;
};

const cornersToColumns = (corners: StoredPitchCorners | null) =>
  corners
    ? {
        end_a_corner_1_lat: corners.end_a_corner_1.lat,
        end_a_corner_1_lng: corners.end_a_corner_1.lng,
        end_a_corner_2_lat: corners.end_a_corner_2.lat,
        end_a_corner_2_lng: corners.end_a_corner_2.lng,
        end_b_corner_1_lat: corners.end_b_corner_1.lat,
        end_b_corner_1_lng: corners.end_b_corner_1.lng,
        end_b_corner_2_lat: corners.end_b_corner_2.lat,
        end_b_corner_2_lng: corners.end_b_corner_2.lng,
      }
    : {
        end_a_corner_1_lat: null,
        end_a_corner_1_lng: null,
        end_a_corner_2_lat: null,
        end_a_corner_2_lng: null,
        end_b_corner_1_lat: null,
        end_b_corner_1_lng: null,
        end_b_corner_2_lat: null,
        end_b_corner_2_lng: null,
      };

export const pitchCornersFromRead = (pitch: PitchRead): StoredPitchCorners => ({
  end_a_corner_1: pitch.end_a_corner_1,
  end_a_corner_2: pitch.end_a_corner_2,
  end_b_corner_1: pitch.end_b_corner_1,
  end_b_corner_2: pitch.end_b_corner_2,
});

export const seedTrackingSession = async ({
  startOut,
  pitchName,
  pitchCorners,
  extraTimeEnabled = null,
  plannedExtraTimeSegmentLengthMinutes = null,
  trainingActivityOptions = [],
  startingActivityKind = null,
}: {
  startOut: SessionStartOut;
  pitchName: string | null;
  pitchCorners: StoredPitchCorners | null;
  extraTimeEnabled?: boolean | null;
  plannedExtraTimeSegmentLengthMinutes?: number | null;
  trainingActivityOptions?: ActivityKind[];
  startingActivityKind?: ActivityKind | null;
}) => {
  const db = await getDb();
  const { session, segments } = startOut;
  if (!session?.id) {
    throw new Error('Kickoff response missing session id');
  }

  const startedAt = session.started_at ?? new Date().toISOString();
  const segmentClockOriginMs = Date.now();
  const cornerCols = cornersToColumns(pitchCorners);
  const segmentRows = segments ?? [];
  const currentSegment = segmentRows[0] ?? null;
  const playStructure = normalizePlayStructure(session.play_structure);
  const resolvedExtraTimeEnabled = extraTimeEnabled ?? session.extra_time_enabled ?? false;
  const resolvedExtraMinutes =
    plannedExtraTimeSegmentLengthMinutes ??
    session.planned_extra_time_segment_length_minutes ??
    null;
  const resolvedActivityOptions =
    trainingActivityOptions.length > 0
      ? trainingActivityOptions
      : (session.training_activity_options ?? []);

  await db.runAsync(
    `INSERT OR REPLACE INTO tracking_sessions (
      id, session_type, play_structure, planned_segment_length_minutes,
      extra_time_enabled, planned_extra_time_segment_length_minutes, training_activity_options,
      pitch_id, pitch_name,
      end_a_corner_1_lat, end_a_corner_1_lng, end_a_corner_2_lat, end_a_corner_2_lng,
      end_b_corner_1_lat, end_b_corner_1_lng, end_b_corner_2_lat, end_b_corner_2_lng,
      started_at, ended_at, sync_status, sync_attempts, last_sync_attempt_at,
      tracking_status, last_accepted_fix_at, auto_resume_cooldown_until,
      background_permission, live_activity_id, next_sequence_index,
      segment_clock_origin_ms, current_segment_id, gps_search_started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', 0, NULL, 'live', NULL, NULL, 'when_in_use', NULL, 0, ?, ?, NULL)`,
    [
      session.id,
      session.session_type,
      playStructure,
      session.planned_segment_length_minutes,
      resolvedExtraTimeEnabled ? 1 : 0,
      resolvedExtraMinutes,
      serializeTrainingActivityOptions(resolvedActivityOptions),
      session.pitch_id,
      pitchName,
      cornerCols.end_a_corner_1_lat,
      cornerCols.end_a_corner_1_lng,
      cornerCols.end_a_corner_2_lat,
      cornerCols.end_a_corner_2_lng,
      cornerCols.end_b_corner_1_lat,
      cornerCols.end_b_corner_1_lng,
      cornerCols.end_b_corner_2_lat,
      cornerCols.end_b_corner_2_lng,
      startedAt,
      segmentClockOriginMs,
      currentSegment?.id ?? null,
    ],
  );

  for (const segment of segmentRows) {
    const activityKind =
      segment.activity_kind ?? (segment.segment_index === 1 ? startingActivityKind : null) ?? null;
    await db.runAsync(
      `INSERT OR REPLACE INTO tracking_segments (id, session_id, segment_index, attack_direction, activity_kind, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [
        segment.id,
        session.id,
        segment.segment_index,
        segment.attack_direction,
        activityKind,
        segment.started_at ?? startedAt,
      ],
    );
  }

  if (currentSegment && startingActivityKind && !currentSegment.activity_kind) {
    await db.runAsync(`UPDATE tracking_segments SET activity_kind = ? WHERE id = ?`, [
      startingActivityKind,
      currentSegment.id,
    ]);
  }
};

export const getActiveTrackingSession = async (): Promise<TrackingSessionRow | null> => {
  const db = await getDb();
  return db.getFirstAsync<TrackingSessionRow>(
    `SELECT * FROM tracking_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
  );
};

export const getTrackingSession = async (sessionId: string): Promise<TrackingSessionRow | null> => {
  const db = await getDb();
  return db.getFirstAsync<TrackingSessionRow>(`SELECT * FROM tracking_sessions WHERE id = ?`, [
    sessionId,
  ]);
};

export const getSegmentsForSession = async (sessionId: string): Promise<TrackingSegmentRow[]> => {
  const db = await getDb();
  return db.getAllAsync<TrackingSegmentRow>(
    `SELECT * FROM tracking_segments WHERE session_id = ? ORDER BY segment_index ASC`,
    [sessionId],
  );
};

export const getCurrentSegment = async (sessionId: string): Promise<TrackingSegmentRow | null> => {
  const db = await getDb();
  return db.getFirstAsync<TrackingSegmentRow>(
    `SELECT * FROM tracking_segments WHERE session_id = ? AND ended_at IS NULL ORDER BY segment_index DESC LIMIT 1`,
    [sessionId],
  );
};

export const getPausesForSession = async (sessionId: string): Promise<TrackingPauseRow[]> => {
  const db = await getDb();
  return db.getAllAsync<TrackingPauseRow>(
    `SELECT * FROM tracking_pauses WHERE session_id = ? ORDER BY started_at ASC`,
    [sessionId],
  );
};

export const getPausesForSegment = async (segmentId: string): Promise<TrackingPauseRow[]> => {
  const db = await getDb();
  return db.getAllAsync<TrackingPauseRow>(
    `SELECT * FROM tracking_pauses WHERE segment_id = ? ORDER BY started_at ASC`,
    [segmentId],
  );
};

export const getOpenPause = async (sessionId: string): Promise<TrackingPauseRow | null> => {
  const db = await getDb();
  return db.getFirstAsync<TrackingPauseRow>(
    `SELECT * FROM tracking_pauses WHERE session_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
    [sessionId],
  );
};

export const getPointsForSession = async (sessionId: string): Promise<TrackingPointRow[]> => {
  const db = await getDb();
  return db.getAllAsync<TrackingPointRow>(
    `SELECT * FROM tracking_points WHERE session_id = ? ORDER BY sequence_index ASC`,
    [sessionId],
  );
};

export const getPointsForSegment = async (segmentId: string): Promise<TrackingPointRow[]> => {
  const db = await getDb();
  return db.getAllAsync<TrackingPointRow>(
    `SELECT * FROM tracking_points WHERE segment_id = ? ORDER BY sequence_index ASC`,
    [segmentId],
  );
};

export const updateSessionFields = async (
  sessionId: string,
  fields: Partial<{
    tracking_status: TrackingStatus;
    last_accepted_fix_at: string | null;
    auto_resume_cooldown_until: string | null;
    background_permission: BackgroundPermission;
    live_activity_id: string | null;
    next_sequence_index: number;
    segment_clock_origin_ms: number;
    current_segment_id: string | null;
    gps_search_started_at: string | null;
    ended_at: string | null;
    sync_status: SyncStatus;
    sync_attempts: number;
    last_sync_attempt_at: string | null;
  }>,
) => {
  const db = await getDb();
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  await db.runAsync(`UPDATE tracking_sessions SET ${setClause} WHERE id = ?`, [
    ...values,
    sessionId,
  ]);
};

export const insertPause = async ({
  sessionId,
  segmentId,
  reason,
  startedAt = new Date().toISOString(),
}: {
  sessionId: string;
  segmentId: string | null;
  reason: TrackingPauseRow['reason'];
  startedAt?: string;
}) => {
  const db = await getDb();
  const id = createTrackingId();
  await db.runAsync(
    `INSERT INTO tracking_pauses (id, session_id, segment_id, reason, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
    [id, sessionId, segmentId, reason, startedAt],
  );
  return id;
};

export const closePause = async (pauseId: string, endedAt = new Date().toISOString()) => {
  const db = await getDb();
  await db.runAsync(`UPDATE tracking_pauses SET ended_at = ? WHERE id = ?`, [endedAt, pauseId]);
};

export const closeOpenPause = async (sessionId: string, endedAt = new Date().toISOString()) => {
  const db = await getDb();
  await db.runAsync(
    `UPDATE tracking_pauses SET ended_at = ? WHERE session_id = ? AND ended_at IS NULL`,
    [endedAt, sessionId],
  );
};

export const closeSegment = async (segmentId: string, endedAt = new Date().toISOString()) => {
  const db = await getDb();
  await db.runAsync(`UPDATE tracking_segments SET ended_at = ? WHERE id = ?`, [endedAt, segmentId]);
};

export const insertSegment = async ({
  sessionId,
  segmentIndex,
  attackDirection,
  activityKind = null,
  startedAt = new Date().toISOString(),
}: {
  sessionId: string;
  segmentIndex: number;
  attackDirection: TrackingSegmentRow['attack_direction'];
  activityKind?: ActivityKind | null;
  startedAt?: string;
}) => {
  const db = await getDb();
  const id = createTrackingId();
  await db.runAsync(
    `INSERT INTO tracking_segments (id, session_id, segment_index, attack_direction, activity_kind, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [id, sessionId, segmentIndex, attackDirection, activityKind, startedAt],
  );
  return id;
};

export const insertTrackPoint = async ({
  sessionId,
  segmentId,
  sequenceIndex,
  recordedAt,
  lat,
  lng,
  speedKmh,
  speedAccuracyMps,
  horizontalAccuracyM,
}: {
  sessionId: string;
  segmentId: string | null;
  sequenceIndex: number;
  recordedAt: string;
  lat: number;
  lng: number;
  speedKmh: number | null;
  speedAccuracyMps: number | null;
  horizontalAccuracyM: number | null;
}) => {
  const db = await getDb();
  const id = createTrackingId();
  await db.runAsync(
    `INSERT INTO tracking_points (id, session_id, segment_id, sequence_index, recorded_at, lat, lng, speed_kmh, speed_accuracy_mps, horizontal_accuracy_m)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sessionId,
      segmentId,
      sequenceIndex,
      recordedAt,
      lat,
      lng,
      speedKmh,
      speedAccuracyMps,
      horizontalAccuracyM,
    ],
  );
};

export const deletePointsForSession = async (sessionId: string) => {
  const db = await getDb();
  await db.runAsync(`DELETE FROM tracking_points WHERE session_id = ?`, [sessionId]);
};

export const getSessionsPendingSync = async (): Promise<TrackingSessionRow[]> => {
  const db = await getDb();
  return db.getAllAsync<TrackingSessionRow>(
    `SELECT * FROM tracking_sessions WHERE ended_at IS NOT NULL AND sync_status IN ('pending', 'failed') ORDER BY ended_at ASC`,
  );
};

export const initTrackingDb = () => getDb();

// re-export SessionRead for convenience in lifecycle
export type { SessionRead };
