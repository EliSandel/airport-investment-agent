import { AirportMetrics } from './metrics';
import { rescaleWeights, scoreAirports } from './scoring';

const m = (
  code: string,
  passengers: number,
  loadFactor: number | null,
  growth: number | null,
): AirportMetrics => ({
  code,
  name: code,
  city: '',
  state: 'MA',
  passengers,
  loadFactor,
  growth,
  intlShare: null,
  congestion: null,
});

describe('scoreAirports', () => {
  it('reproduces the hand-worked New England example', () => {
    const result = scoreAirports(
      [
        m('BOS', 20_000_000, 0.84, 0.08),
        m('PVD', 2_000_000, 0.8, 0.15),
        m('BDL', 3_000_000, 0.86, 0.05),
        m('PWM', 1_300_000, 0.78, 0.2),
      ],
      { loadFactor: 0.4, growth: 0.35, scale: 0.25, congestion: 0 },
    );
    const by = Object.fromEntries(result.airports.map((a) => [a.code, a]));

    expect(result.airports.map((a) => a.code)).toEqual([
      'BOS',
      'BDL',
      'PVD',
      'PWM',
    ]);
    expect(by.BOS.score).toBeCloseTo(63.33, 1);
    expect(by.BDL.score).toBeCloseTo(56.67, 1);
    expect(by.PVD.score).toBeCloseTo(45, 1);
    expect(by.PWM.score).toBeCloseTo(35, 1);
    expect(by.BOS.rank).toBe(1);
  });

  it('excludes airports below the passenger threshold', () => {
    const result = scoreAirports([
      m('BIG', 5_000_000, 0.8, 0.1),
      m('MID', 1_000_000, 0.7, 0.05),
      m('TINY', 50_000, 0.95, 0.9),
    ]);
    expect(result.meta.universeSize).toBe(2);
    expect(result.airports.map((a) => a.code)).not.toContain('TINY');
  });

  it('disables a factor nobody has data for and rescales the weights', () => {
    const result = scoreAirports([
      m('A', 5_000_000, 0.8, 0.1),
      m('B', 1_000_000, 0.7, 0.05),
    ]);
    const w = result.meta.weights;
    expect(result.meta.disabledFactors).toEqual(['congestion']);
    expect(w.congestion).toBe(0);
    expect(w.loadFactor).toBeCloseTo(0.35 / 0.85);
    expect(w.loadFactor + w.growth + w.scale).toBeCloseTo(1);
    // Not the airports' fault, so confidence stays high
    expect(result.airports.every((a) => a.confidence === 'high')).toBe(true);
  });

  it('rescales weights for an airport missing a factor and lowers confidence', () => {
    const result = scoreAirports([
      m('A', 5_000_000, 0.8, 0.1),
      m('B', 1_000_000, 0.7, 0.05),
      m('C', 2_000_000, 0.75, null),
    ]);
    const c = result.airports.find((a) => a.code === 'C')!;
    expect(c.missingFactors).toEqual(['growth']);
    expect(c.confidence).toBe('medium');
    expect(c.factors.growth.weight).toBe(0);
    expect(c.factors.loadFactor.weight + c.factors.scale.weight).toBeCloseTo(1);
  });

  it('score equals the sum of factor contributions', () => {
    const result = scoreAirports([
      m('A', 5_000_000, 0.8, 0.1),
      m('B', 1_000_000, 0.7, 0.05),
      m('C', 2_000_000, 0.75, 0.2),
    ]);
    for (const a of result.airports) {
      const sum = Object.values(a.factors).reduce(
        (s, f) => s + f.contribution,
        0,
      );
      expect(a.score).toBeCloseTo(sum);
    }
  });
});

describe('rescaleWeights', () => {
  it('turns relative weights into weights that sum to 1', () => {
    expect(
      rescaleWeights({ loadFactor: 2, growth: 1, scale: 1, congestion: 0 }),
    ).toEqual({ loadFactor: 0.5, growth: 0.25, scale: 0.25, congestion: 0 });
  });

  it('throws when every active weight is zero', () => {
    expect(() =>
      rescaleWeights({ loadFactor: 0, growth: 0, scale: 0, congestion: 0 }),
    ).toThrow();
  });
});
