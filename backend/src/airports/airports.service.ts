import { computeLongHaul } from '../scoring/long-haul';
import {
    Weights,
    scoreAirports,
    MIN_PASSENGERS,
    DEFAULT_WEIGHTS,
} from '../scoring/scoring';
import { AirportDataService } from './airport-data.service';
import { Injectable, NotFoundException } from '@nestjs/common';

export interface RankOptions {
  states?: string[]; // e.g. New England = ME, NH, VT, MA, RI, CT
  weights?: Partial<Weights>; // override some weights, keep the rest default
  limit?: number;
}

@Injectable()
export class AirportsService {
  constructor(private readonly data: AirportDataService) {}

  /** Ranks airports nationally, then filters to the requested states. */
  rank(options: RankOptions = {}) {
    const weights = { ...DEFAULT_WEIGHTS, ...options.weights }; // for overriding
    const result = scoreAirports(this.data.metrics, weights);

    const states = options.states?.map((s) => s.trim().toUpperCase());
    const airportsInStates = states?.length
      ? result.airports.filter((a) => states.includes(a.state))
      : result.airports;

    return {
      meta: {
        ...result.meta,
        filterStates: states ?? null,
        matchingAirports: airportsInStates.length,
        dataSnapshot: this.data.file.metadata.generatedAt,
      },
      airports: airportsInStates.slice(0, options.limit ?? 10),
    };
  }

  /** Everything we know about one airport: info, raw years, metrics, score. */
  getAirport(code: string) {
    const record = this.data.getRecord(code);
    if (!record) throw new NotFoundException(`Unknown airport code: ${code}`);

    const ranked = scoreAirports(this.data.metrics).airports.find(
      (a) => a.code === record.code,
    );

    return {
      info: {
        code: record.code,
        name: record.name,
        city: record.city,
        state: record.state,
      },
      years: record.years,
      delays: record.delays ?? null,
      metrics: this.data.getMetrics(record.code),
      ranking: ranked ?? null,
      note: ranked
        ? undefined
        : `Not ranked: below ${MIN_PASSENGERS.toLocaleString()} departing passengers`,
    };
  }

  compare(codes: string[]) {
    return codes.map((c) => this.getAirport(c));
  }

  /** Long-haul share of departing flights (all / passenger / cargo). */
  getLongHaul(code: string, thresholdMiles?: number) {
    const record = this.data.getRecord(code);
    if (!record) throw new NotFoundException(`Unknown airport code: ${code}`);

    const airport = { code: record.code, name: record.name, state: record.state };
    if (!record.routes?.length) {
      return { airport, note: 'No route-level data available for this airport' };
    }
    return {
      airport,
      ...computeLongHaul(record.routes, thresholdMiles),
      source: 'BTS T-100 Segment 2025 (all carriers)',
    };
  }
  
}