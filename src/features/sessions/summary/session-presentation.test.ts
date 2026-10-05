import { describe, expect, it } from 'vitest';
import {
  deriveSessionTitle,
  displaySessionTitle,
  formatHistoryMeta,
  partOfDay,
  presentSessionMetrics,
} from './session-presentation';

const localIso = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe('partOfDay', () => {
  it('uses the 05 / 12 / 17 / 21 boundaries', () => {
    expect(partOfDay(4)).toBe('Night');
    expect(partOfDay(5)).toBe('Morning');
    expect(partOfDay(11)).toBe('Morning');
    expect(partOfDay(12)).toBe('Afternoon');
    expect(partOfDay(17)).toBe('Evening');
    expect(partOfDay(20)).toBe('Evening');
    expect(partOfDay(21)).toBe('Night');
  });
});

describe('deriveSessionTitle', () => {
  it('builds weekday, part of day and type from local kickoff', () => {
    expect(
      deriveSessionTitle({ startedAt: localIso(2026, 9, 26, 9, 30), sessionType: 'match' }),
    ).toBe('Saturday Morning Match');
    expect(
      deriveSessionTitle({ startedAt: localIso(2026, 9, 24, 18, 15), sessionType: 'training' }),
    ).toBe('Thursday Evening Training');
  });

  it('gives an after-midnight kickoff the new day', () => {
    expect(
      deriveSessionTitle({ startedAt: localIso(2026, 9, 27, 0, 30), sessionType: 'futsal' }),
    ).toBe('Sunday Night Futsal');
  });
});

describe('displaySessionTitle', () => {
  const base = { startedAt: localIso(2026, 9, 26, 9), sessionType: 'match' as const };

  it('prefers a pending rename, then the stored title, then derived', () => {
    expect(displaySessionTitle({ ...base, title: 'Stored', pendingTitle: 'Pending' })).toBe(
      'Pending',
    );
    expect(displaySessionTitle({ ...base, title: 'Stored' })).toBe('Stored');
    expect(displaySessionTitle(base)).toBe('Saturday Morning Match');
  });

  it('treats a pending clear as the derived title', () => {
    expect(displaySessionTitle({ ...base, title: 'Stored', pendingTitle: null })).toBe(
      'Saturday Morning Match',
    );
  });
});

describe('formatHistoryMeta', () => {
  const now = new Date(2026, 9, 5);

  it('omits the pitch when there is none', () => {
    expect(
      formatHistoryMeta({ startedAt: localIso(2026, 9, 27, 10), sessionType: 'match', now }),
    ).toBe('27 SEP · MATCH');
  });

  it('appends the year outside the current year', () => {
    expect(
      formatHistoryMeta({
        startedAt: localIso(2025, 9, 27, 10),
        pitchName: 'Lekki',
        sessionType: 'match',
        now,
      }),
    ).toBe('27 SEP 2025 · LEKKI · MATCH');
  });
});

describe('presentSessionMetrics', () => {
  const metrics = {
    distance_m: 5100,
    top_speed_kmh: 26.1,
    sprint_count: 4,
    calories_kcal: 400,
    speed_source: 'os' as const,
    data_quality: 'good' as const,
  };

  it('returns no_metrics without a metrics row', () => {
    expect(presentSessionMetrics(null)).toEqual({ kind: 'no_metrics' });
  });

  it('returns insufficient for unusable signal', () => {
    expect(presentSessionMetrics({ ...metrics, data_quality: 'insufficient' })).toEqual({
      kind: 'insufficient',
    });
  });

  it('marks distance estimated but leaves top speed unmarked', () => {
    const result = presentSessionMetrics({ ...metrics, data_quality: 'estimated' });
    expect(result).toMatchObject({
      kind: 'metrics',
      distance: { kind: 'value', estimated: true },
      topSpeed: { kind: 'value', estimated: false },
    });
  });

  it('suppresses speed-derived metrics when no speed was recorded', () => {
    const result = presentSessionMetrics({ ...metrics, speed_source: 'none' });
    expect(result).toMatchObject({
      kind: 'metrics',
      topSpeed: { kind: 'suppressed' },
      sprintCount: { kind: 'suppressed' },
      calories: { kind: 'value', estimated: true },
    });
  });
});
