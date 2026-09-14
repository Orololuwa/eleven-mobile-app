/** Keep stored indexes when they are already unique; otherwise assign 0..n-1 in list order. */
export const withUniqueSequenceIndexes = <T extends { sequence_index: number }>(
  points: T[],
): T[] => {
  if (points.length === 0) return points;
  const uniqueCount = new Set(points.map((point) => point.sequence_index)).size;
  if (uniqueCount === points.length) return points;
  return points.map((point, sequence_index) => ({ ...point, sequence_index }));
};
