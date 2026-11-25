import { AirportMetrics } from './metrics';
import { percentileRanks } from './percentile';

// ---------------------------------------------------------------- config

export type Factor = 'loadFactor' | 'growth' | 'scale' | 'congestion';
export type Weights = Record<Factor, number>;

export const FACTORS: Factor[] = ['loadFactor', 'growth', 'scale', 'congestion'];

export const DEFAULT_WEIGHTS: Weights = {
  loadFactor: 0.35,
  growth: 0.3,
  scale: 0.2,
  congestion: 0.15,
};

/** Airports below this are too small/noisy to rank (they stay queryable). */
export const MIN_PASSENGERS = 100_000;

/** Which raw metric feeds each factor. Scale = passenger volume. */
const RAW_VALUE: Record<Factor, (metrics: AirportMetrics) => number | null> = {
  loadFactor: (metrics) => metrics.loadFactor,
  growth: (metrics) => metrics.growth,
  scale: (metrics) => metrics.passengers,
  congestion: (metrics) => metrics.congestion,
};

// ---------------------------------------------------------------- types

export interface FactorScore { 
  raw: number | null; // e.g. load factor 0.816
  percentile: number | null; // 0-100 vs the national universe
  weight: number; // effective weight actually used for this airport
  contribution: number; // percentile * weight -> points added to the score
}

export interface ScoredAirport {
  code: string;
  name: string;
  city: string;
  state: string;
  score: number; // 0-100
  rank: number; // 1 = best, among all ranked airports
  factors: Record<Factor, FactorScore>;
  missingFactors: Factor[]; // factors with no data for THIS airport
  confidence: 'high' | 'medium' | 'low';
}

export interface ScoringResult {
  airports: ScoredAirport[]; // sorted best first
  meta: {
    universeSize: number; // how many airports were ranked
    minPassengers: number;
    weights: Weights; // normalized weights after disabling unavailable factors
    disabledFactors: Factor[]; // factors with no data for ANY airport
  };
}

// ---------------------------------------------------------------- scoring

export function scoreAirports(
  all: AirportMetrics[],
  weights: Weights = DEFAULT_WEIGHTS,
): ScoringResult {
  // 1. Comparison universe: only airports big enough to rank.
  const universe = all.filter((airport) => airport.passengers >= MIN_PASSENGERS);

  // 2. Percentile per factor, computed across the whole universe.
  const percentiles = {} as Record<Factor, (number | null)[]>;
  for (const f of FACTORS) {
    percentiles[f] = percentileRanks(universe.map(RAW_VALUE[f]));
  }

  // 3. A factor with no data at all (e.g. congestion before delay data exists)
  //    is a model-wide limitation, not a per-airport one: switch it off.
  const disabledFactors = FACTORS.filter((factor) =>
    percentiles[factor].every((p) => p === null),
  );
  const modelWeights = normalize(weights, disabledFactors);

  // 4. Score each airport.
  const scored = universe.map((airport, i): ScoredAirport => {
    const missingFactors = FACTORS.filter(
      (factor) => !disabledFactors.includes(factor) && percentiles[factor][i] === null,
    );
    // Re-scale weights again if THIS airport is missing something.
    const weights = normalize(modelWeights, missingFactors);

    const factors = {} as Record<Factor, FactorScore>;
    let score = 0;
    for (const factor of FACTORS) {
      const percentile = percentiles[factor][i];
      const contribution = percentile === null ? 0 : percentile * weights[factor];
      factors[factor] = {
        raw: RAW_VALUE[factor](airport),
        percentile,
        weight: weights[factor],
        contribution,
      };
      score += contribution;
    }

    return {
      code: airport.code,
      name: airport.name,
      city: airport.city,
      state: airport.state,
      score,
      rank: 0, // filled in after sorting
      factors,
      missingFactors,
      confidence:
        missingFactors.length === 0
          ? 'high'
          : missingFactors.length === 1
            ? 'medium'
            : 'low',
    };
  });

  // 5. Sort best first and assign ranks.
  scored.sort((a, b) => b.score - a.score);
  scored.forEach((a, idx) => (a.rank = idx + 1));

  return {
    airports: scored,
    meta: {
      universeSize: universe.length,
      minPassengers: MIN_PASSENGERS,
      weights: modelWeights,
      disabledFactors,
    },
  };
}

/**
 * Sets excluded factors to 0 and rescales the rest so they sum to 1.
 * Also lets callers pass weights like {growth: 2, loadFactor: 1, ...}.
 */
export function normalize(weights: Weights, exclude: Factor[] = []): Weights {
  const active = FACTORS.filter((f) => !exclude.includes(f));
  const total = active.reduce((sum, f) => sum + Math.max(0, weights[f]), 0);
  if (total === 0) throw new Error('At least one active weight must be > 0');

  const result = {} as Weights;
  for (const f of FACTORS) {
    result[f] = active.includes(f) ? Math.max(0, weights[f]) / total : 0;
  }
  return result;
}