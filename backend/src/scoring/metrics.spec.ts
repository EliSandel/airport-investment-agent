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

  it('computes congestion as the NAS-delayed share of arrivals', () => {
    const rec = airport({ '2025': year(1100, 1250) });
    expect(computeMetrics(rec).congestion).toBeNull(); // no delay data

    rec.delays = {
      year: '2025',
      arrFlights: 1000,
      arrDel15: 200,
      nasDelayed: 80,
      nasDelayMinutes: 5000,
    };
    expect(computeMetrics(rec).congestion).toBeCloseTo(0.08); // 80 / 1000
  });
});
