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
    const matching = states?.length
      ? result.airports.filter((a) => states.includes(a.state))
      : result.airports;

    return {
      meta: {
        ...result.meta,
        filterStates: states ?? null,
        matchingAirports: matching.length,
        dataSnapshot: this.data.file.metadata.generatedAt,
      },
      airports: matching.slice(0, options.limit ?? 10),
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
}