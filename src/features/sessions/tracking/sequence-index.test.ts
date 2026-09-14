import { describe, expect, it } from 'vitest';
import { withUniqueSequenceIndexes } from './sequence-index';

describe('withUniqueSequenceIndexes', () => {
  it('returns the same list when sequence_index values are already unique', () => {
    const points = [{ sequence_index: 0 }, { sequence_index: 4 }, { sequence_index: 9 }];
    expect(withUniqueSequenceIndexes(points)).toBe(points);
  });

  it('reassigns 0..n-1 in list order when duplicates exist', () => {
    const points = [
      { sequence_index: 0, recorded_at: 'a' },
      { sequence_index: 0, recorded_at: 'b' },
      { sequence_index: 1, recorded_at: 'c' },
      { sequence_index: 1, recorded_at: 'd' },
    ];
    expect(withUniqueSequenceIndexes(points)).toEqual([
      { sequence_index: 0, recorded_at: 'a' },
      { sequence_index: 1, recorded_at: 'b' },
      { sequence_index: 2, recorded_at: 'c' },
      { sequence_index: 3, recorded_at: 'd' },
    ]);
  });

  it('leaves an empty list unchanged', () => {
    const points: { sequence_index: number }[] = [];
    expect(withUniqueSequenceIndexes(points)).toBe(points);
  });
});
