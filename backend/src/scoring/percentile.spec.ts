import { percentileRanks } from './percentile';

describe('percentileRanks', () => {
  it('ranks distinct values by position (the worked example)', () => {
    const result = percentileRanks([8, 15, 5, 20]);
    expect(result[0]).toBeCloseTo(33.33, 1); // 8  -> 1 value below
    expect(result[1]).toBeCloseTo(66.67, 1); // 15 -> 2 values below
    expect(result[2]).toBe(0); // 5  -> lowest
    expect(result[3]).toBe(100); // 20 -> highest
  });

  it('gives equal values the same score', () => {
    expect(percentileRanks([5, 5, 10])).toEqual([0, 0, 100]);
  });

  it('keeps null as null and leaves it out of n', () => {
    expect(percentileRanks([5, null, 10])).toEqual([0, null, 100]);
  });

  it('gives a single value 100', () => {
    expect(percentileRanks([42])).toEqual([100]);
  });

  it('handles an empty list', () => {
    expect(percentileRanks([])).toEqual([]);
  });

  it('ignores magnitude: an extreme outlier does not squash the others', () => {
    // Same ranks whether the top value is 20 or 20,000
    expect(percentileRanks([5, 8, 15, 20000])).toEqual(
      percentileRanks([5, 8, 15, 20]),
    );
  });
});