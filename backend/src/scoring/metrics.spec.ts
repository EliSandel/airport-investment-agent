import { computeMetrics } from './metrics';
import { AirportRecord, YearStats } from '../data/airport.types';

const year = (passengers: number, seats: number, intl = 0): YearStats => ({
  passengers,
  seats,
  departures: 0,
  intlPassengers: intl,
  intlSeats: 0,
  freightLbs: 0,
});

const airport = (years: Record<string, YearStats>): AirportRecord => ({
  code: 'TST',
  name: 'Test Airport',
  city: 'Testville',
  state: 'MA',
  lat: 0,
  lon: 0,
  years,
});

describe('computeMetrics', () => {
  it('computes load factor, growth and intl share from yearly sums', () => {
    const m = computeMetrics(
      airport({ '2023': year(1000, 1300), '2025': year(1100, 1250, 220) }),
    );
    expect(m.passengers).toBe(1100);
    expect(m.loadFactor).toBeCloseTo(0.88); // 1100 / 1250
    expect(m.growth).toBeCloseTo(0.1); // 1100 / 1000 - 1
    expect(m.intlShare).toBeCloseTo(0.2); // 220 / 1100
  });

  it('returns null growth (not 0) when the base year is missing', () => {
    const m = computeMetrics(airport({ '2025': year(1100, 1250) }));
    expect(m.growth).toBeNull();
  });

  it('returns null load factor when there are no seats', () => {
    const m = computeMetrics(airport({ '2025': year(0, 0) }));
    expect(m.loadFactor).toBeNull();
  });

  it('passes congestion through, defaulting to null', () => {
    const rec = airport({ '2025': year(1100, 1250) });
    expect(computeMetrics(rec).congestion).toBeNull();
    expect(computeMetrics(rec, 0.12).congestion).toBe(0.12);
  });
});