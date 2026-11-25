
/**
 * Converts raw values into percentile ranks (0-100).
 *
 *   percentile = (number of values BELOW this one) / (n - 1) * 100
 *
 * For distinct values this is exactly "position in the sorted list / last position".
 * Counting values *below* also handles ties: equal values get the same score.
 *
 * null = "no data" for that airport: it is left out of the ranking and stays null.
 *
 * Example: [8, 15, 5, 20] -> [33.3, 66.7, 0, 100]
 */
export function percentileRanks(values: (number | null)[]): (number | null)[] {
  const known = values.filter((value): value is number => value !== null);
  const n = known.length;

  return values.map((v) => {
    if (v === null) return null;
    if (n === 1) return 100; // a single airport is trivially "the best"
    const below = known.filter((other) => other < v).length;
    return (below / (n - 1)) * 100;
  });
}