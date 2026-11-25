import { RouteStats } from '../data/airport.types';
import { computeLongHaul } from './long-haul';

const route = (
  dest: string,
  distance: number,
  departures: number,
  cargoDepartures = 0,
): RouteStats => ({ dest, distance, departures, cargoDepartures, passengers: 0 });

describe('computeLongHaul', () => {
  // 100 short passenger flights + 50 long flights, 40 of which are cargo
  const routes = [route('SEA', 1450, 100), route('ICN', 3780, 50, 40)];

  it('computes long-haul share for all, passenger and cargo flights', () => {
    const r = computeLongHaul(routes, 3000);
    expect(r.allFlights.longHaulShare).toBeCloseTo(50 / 150);
    expect(r.passengerFlights.departures).toBe(110); // 150 - 40 cargo
    expect(r.passengerFlights.longHaulShare).toBeCloseTo(10 / 110);
    expect(r.cargoFlights.longHaulShare).toBe(1); // all cargo flights are long
  });

  it('respects a custom threshold', () => {
    const r = computeLongHaul(routes, 1000);
    expect(r.allFlights.longHaulShare).toBe(1); // both routes are >= 1000 mi
  });

  it('falls back to the default for an invalid threshold', () => {
    expect(computeLongHaul(routes, -5).thresholdMiles).toBe(3000);
  });

  it('returns null shares when there are no flights', () => {
    expect(computeLongHaul([]).allFlights.longHaulShare).toBeNull();
  });
});