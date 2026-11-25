import { RouteStats } from '../data/airport.types';

/** Definitions of "long-haul" vary (roughly 2,500-3,500 mi); this is our default. */
export const DEFAULT_LONG_HAUL_MILES = 3000;

export interface FlightShare {
  departures: number; // all flights in this group
  longHaulDepartures: number; // flights on routes >= threshold
  longHaulShare: number | null; // 0-1, null if there were no flights
}

export interface LongHaulResult {
  thresholdMiles: number;
  allFlights: FlightShare;
  passengerFlights: FlightShare;
  cargoFlights: FlightShare;
  topLongHaulDestinations: RouteStats[];
}

const share = (part: number, total: number): number | null =>
  total > 0 ? part / total : null;

export function computeLongHaul(
  routes: RouteStats[],
  thresholdMiles: number = DEFAULT_LONG_HAUL_MILES,
): LongHaulResult {
  // Guard against nonsense input from the model (negative, NaN...).
  const threshold =
    Number.isFinite(thresholdMiles) && thresholdMiles > 0
      ? thresholdMiles
      : DEFAULT_LONG_HAUL_MILES;

  let all = 0;
  let allLong = 0;
  let cargo = 0;
  let cargoLong = 0;

  for (const route of routes) {
    const isLong = route.distance >= threshold;
    all += route.departures;
    cargo += route.cargoDepartures;
    if (isLong) {
      allLong += route.departures;
      cargoLong += route.cargoDepartures;
    }
  }

  // Passenger flights = everything that wasn't flown by a cargo aircraft.
  const passenger = all - cargo;
  const passengerLong = allLong - cargoLong;

  return {
    thresholdMiles: threshold,
    allFlights: {
      departures: all,
      longHaulDepartures: allLong,
      longHaulShare: share(allLong, all),
    },
    passengerFlights: {
      departures: passenger,
      longHaulDepartures: passengerLong,
      longHaulShare: share(passengerLong, passenger),
    },
    cargoFlights: {
      departures: cargo,
      longHaulDepartures: cargoLong,
      longHaulShare: share(cargoLong, cargo),
    },
    topLongHaulDestinations: routes
      .filter((r) => r.distance >= threshold)
      .sort((a, b) => b.departures - a.departures)
      .slice(0, 10),
  };
}