import { describe, expect, it } from 'vitest';
import { LOCATION_FIX_STALE_MS } from './constants';
import { isFixFeedStale } from './fix-feed';

describe('isFixFeedStale', () => {
  const nowMs = 1_000_000;

  it('is stale when there is no fix', () => {
    expect(isFixFeedStale({ fix: null, nowMs })).toBe(true);
  });

  it('is fresh within the stale window', () => {
    expect(
      isFixFeedStale({
        fix: { accuracyM: 5, atMs: nowMs - LOCATION_FIX_STALE_MS + 1 },
        nowMs,
      }),
    ).toBe(false);
  });

  it('is stale past the stale window', () => {
    expect(
      isFixFeedStale({
        fix: { accuracyM: 5, atMs: nowMs - LOCATION_FIX_STALE_MS - 1 },
        nowMs,
      }),
    ).toBe(true);
  });
});
