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

  it('stops on explicit ended status without needing null confirmation', () => {
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

  it('skips a single null session read without stopping', () => {
    expect(nextTeardownAction({ session: null, previousNullCount: 0 })).toEqual({
      nullCount: 1,
      action: 'skip',
      reason: 'null-session',
    });
  });

  it('skips the second consecutive null', () => {
    expect(nextTeardownAction({ session: null, previousNullCount: 1 })).toEqual({
      nullCount: 2,
      action: 'skip',
      reason: 'null-session',
    });
  });

  it('stops only after three consecutive null session reads', () => {
    expect(nextTeardownAction({ session: null, previousNullCount: 2 })).toEqual({
      nullCount: 3,
      action: 'stop',
      reason: 'null-session-confirmed',
    });
  });
});
