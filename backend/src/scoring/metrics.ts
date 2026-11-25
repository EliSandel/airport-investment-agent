import { AirportRecord } from '../data/airport.types';

/** Growth compares these two years (both post-COVID). */
export const CURRENT_YEAR = '2025';
export const BASE_YEAR = '2023';

/**
 * Derived metrics for one airport: the raw inputs to scoring.
 * null means "can't be computed from the data we have".
 */
export interface AirportMetrics {
  code: string;
  name: string;
  city: string;
  state: string;
  passengers: number; // CURRENT_YEAR departing passengers
  loadFactor: number | null; // 0-1, passengers / seats
  growth: number | null; // e.g. 0.057 = +5.7% vs BASE_YEAR
  intlShare: number | null; // share of passengers on international flights
  congestion: number | null; // NAS delay signal (not wired up yet)
}

export function computeMetrics(
  airport: AirportRecord,
  congestion: number | null = null,
): AirportMetrics {
  const current = airport.years[CURRENT_YEAR];
  const base = airport.years[BASE_YEAR];

  return {
    code: airport.code,
    name: airport.name,
    city: airport.city,
    state: airport.state,
    passengers: current?.passengers ?? 0,

    // Yearly sums, NOT an average of the monthly % column.
    loadFactor:
      current && current.seats > 0 ? current.passengers / current.seats : null,

    growth:
      current && base && base.passengers > 0   // check if base.passenger > 0 because we dont want to divide by 0
        ? current.passengers / base.passengers - 1
        : null,

    intlShare:
      current && current.passengers > 0
        ? current.intlPassengers / current.passengers
        : null,

    congestion,
  };
}