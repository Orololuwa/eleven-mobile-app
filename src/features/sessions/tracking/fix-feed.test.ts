import { describe, expect, it } from 'vitest';
import { LOCATION_FIX_STALE_MS } from './constants';
import { isFixFeedStale, watchShouldYieldToTask } from './fix-feed';

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

describe('watchShouldYieldToTask', () => {
  const nowMs = 1_000_000;

  it('does not yield before the task has delivered anything', () => {
    expect(watchShouldYieldToTask({ lastTaskDeliveryAtMs: null, nowMs })).toBe(false);
  });

  it('yields while the task delivered recently', () => {
    expect(
      watchShouldYieldToTask({ lastTaskDeliveryAtMs: nowMs - 1_000, nowMs, yieldMs: 3_000 }),
    ).toBe(true);
  });

  it('takes over again once the task has gone quiet', () => {
    expect(
      watchShouldYieldToTask({ lastTaskDeliveryAtMs: nowMs - 3_001, nowMs, yieldMs: 3_000 }),
    ).toBe(false);
  });
});
