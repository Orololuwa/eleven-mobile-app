import { describe, expect, it } from 'vitest';
import { nextTeardownAction } from './registration-teardown';

describe('nextTeardownAction', () => {
  it('processes a live session and resets the null counter', () => {
    expect(
      nextTeardownAction({
        session: { tracking_status: 'live', ended_at: null },
        previousNullCount: 2,
      }),
    ).toEqual({ nullCount: 0, action: 'process', reason: 'live' });
  });

  it('stops on explicit ended status', () => {
    expect(
      nextTeardownAction({
        session: { tracking_status: 'ended', ended_at: null },
        previousNullCount: 0,
      }),
    ).toEqual({ nullCount: 0, action: 'stop', reason: 'ended' });
  });

  it('stops when ended_at is set', () => {
    expect(
      nextTeardownAction({
        session: { tracking_status: 'live', ended_at: '2026-10-16T06:00:00.000Z' },
        previousNullCount: 0,
      }),
    ).toEqual({ nullCount: 0, action: 'stop', reason: 'ended' });
  });

  it('skips a null session read without stopping', () => {
    expect(nextTeardownAction({ session: null, previousNullCount: 0 })).toEqual({
      nullCount: 1,
      action: 'skip',
      reason: 'null-session',
    });
  });

  it('never stops on repeated null session reads', () => {
    expect(nextTeardownAction({ session: null, previousNullCount: 2 })).toEqual({
      nullCount: 3,
      action: 'skip',
      reason: 'null-session',
    });
    expect(nextTeardownAction({ session: null, previousNullCount: 99 })).toEqual({
      nullCount: 100,
      action: 'skip',
      reason: 'null-session',
    });
  });
});
