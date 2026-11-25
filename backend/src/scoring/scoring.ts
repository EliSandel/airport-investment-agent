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

/**
 * For each factor: how to read its raw value from an airport's metrics.
 * Lets the scoring loop treat all factors the same way.
 * Note: "scale" is simply the passenger count.
 */
const FACTOR_VALUE: Record<Factor, (airport: AirportMetrics) => number | null> = {
  loadFactor: (airport) => airport.loadFactor,
  growth: (airport) => airport.growth,
  scale: (airport) => airport.passengers,
  congestion: (airport) => airport.congestion,
};

// ---------------------------------------------------------------- types

export interface FactorScore {
  raw: number | null; // the airport's own value, e.g. load factor 0.816
  percentile: number | null; // 0-100: higher than this % of ranked airports
  weight: number; // weight actually used for this airport (after rescaling)
  contribution: number; // percentile * weight = points added to the score
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
    weights: Weights; // weights used, after disabling factors with no data
    disabledFactors: Factor[]; // factors with no data for ANY airport
  };
}

// ---------------------------------------------------------------- scoring

export function scoreAirports(
  allAirports: AirportMetrics[],
  weights: Weights = DEFAULT_WEIGHTS,
): ScoringResult {
  // 1. Comparison universe: only airports big enough to rank.
  const universe = allAirports.filter(
    (airport) => airport.passengers >= MIN_PASSENGERS,
  );

  // 2. Percentile per factor, computed across the whole universe.
  //    percentiles.growth[i] is the growth percentile of universe[i].
  const percentiles = {} as Record<Factor, (number | null)[]>;
  for (const factor of FACTORS) {
    percentiles[factor] = percentileRanks(universe.map(FACTOR_VALUE[factor]));
  }

  // 3. A factor with no data for ANY airport is a limitation of the model,
  //    not of a specific airport: switch it off for everyone.
  const disabledFactors = FACTORS.filter((factor) =>
    percentiles[factor].every((p) => p === null),
  );
  const activeWeights = rescaleWeights(weights, disabledFactors);

  // 4. Score each airport.
  const scored = universe.map((airport, i): ScoredAirport => {
    // Factors THIS airport has no data for (while others do).
    const missingFactors = FACTORS.filter(
      (factor) =>
        !disabledFactors.includes(factor) && percentiles[factor][i] === null,
    );
    // Give the missing factors' weight to the factors this airport does have.
    const airportWeights = rescaleWeights(activeWeights, missingFactors);

    const factors = {} as Record<Factor, FactorScore>;
    let score = 0;
    for (const factor of FACTORS) {
      const percentile = percentiles[factor][i];
      const weight = airportWeights[factor];
      const contribution = percentile === null ? 0 : percentile * weight;

      factors[factor] = {
        raw: FACTOR_VALUE[factor](airport),
        percentile,
        weight,
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
  scored.forEach((airport, index) => (airport.rank = index + 1));

  return {
    airports: scored,
    meta: {
      universeSize: universe.length,
      minPassengers: MIN_PASSENGERS,
      weights: activeWeights,
      disabledFactors,
    },
  };
}

/**
 * Sets the excluded factors' weights to 0 and rescales the rest so they sum to 1.
 * Also accepts relative weights, e.g. {growth: 2, loadFactor: 1, ...}.
 */
export function rescaleWeights(
  weights: Weights,
  exclude: Factor[] = [],
): Weights {
  const included = FACTORS.filter((factor) => !exclude.includes(factor));
  const total = included.reduce(
    (sum, factor) => sum + Math.max(0, weights[factor]),
    0,
  );
  if (total === 0) throw new Error('At least one active weight must be > 0');

  const result = {} as Weights;
  for (const factor of FACTORS) {
    result[factor] = included.includes(factor)
      ? Math.max(0, weights[factor]) / total
      : 0;
  }
  return result;
}