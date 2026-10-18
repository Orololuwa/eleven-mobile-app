import { describe, expect, it } from 'vitest';
import { needsForcedRenew, shouldWaitForAppActive } from './registration-recovery';

describe('shouldWaitForAppActive', () => {
  it('waits only for the initial HUD kickoff', () => {
    expect(shouldWaitForAppActive('start')).toBe(true);
  });

  it('does not wait for recovery reasons', () => {
    expect(shouldWaitForAppActive('watchdog')).toBe(false);
    expect(shouldWaitForAppActive('app-state')).toBe(false);
    expect(shouldWaitForAppActive('foreground')).toBe(false);
  });
});

describe('needsForcedRenew', () => {
  it('is false when the task is running and the feed is fresh', () => {
    expect(needsForcedRenew({ running: true, feedStale: false })).toBe(false);
  });

  it('renews when the task is down', () => {
    expect(needsForcedRenew({ running: false, feedStale: false })).toBe(true);
  });

  it('renews when the feed is stale even if Expo still reports the task running', () => {
    expect(needsForcedRenew({ running: true, feedStale: true })).toBe(true);
  });

  it('renews when both checks fail', () => {
    expect(needsForcedRenew({ running: false, feedStale: true })).toBe(true);
  });
});
