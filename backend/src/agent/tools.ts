import Anthropic from '@anthropic-ai/sdk';
import { AirportsService, RankOptions } from '../airports/airports.service';

/**
 * Tool definitions sent to Claude. The descriptions matter: they are how the
 * model decides WHICH tool to call and WHAT arguments to pass.
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'rank_airports',
    description:
      'Rank US airports by Expansion Score (0-100). Airports are always ranked against ' +
      'the national universe (>=100k departing passengers); the states filter only ' +
      'selects which ranked airports to return. For regions, pass state codes, e.g. ' +
      'New England = ME, NH, VT, MA, RI, CT. Optionally override weights to test ' +
      'how the ranking changes.',
    input_schema: {
      type: 'object',
      properties: {
        states: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Two-letter US state codes. Omit for a national ranking.',
        },
        weights: {
          type: 'object',
          description:
            'Relative weights; omitted factors keep their defaults ' +
            '(loadFactor 0.35, growth 0.30, scale 0.20, congestion 0.15).',
          properties: {
            loadFactor: { type: 'number' },
            growth: { type: 'number' },
            scale: { type: 'number' },
            congestion: { type: 'number' },
          },
        },
        limit: {
          type: 'integer',
          description: 'Max airports to return (default 10, max 25).', //guardrail: limit to 25 airports
        },
      },
    },
  },
  {
    name: 'get_airport',
    description:
      'Everything known about one airport: name, state, yearly raw data ' +
      '(passengers, seats, departures, international passengers, freight) for 2023 ' +
      'and 2025, derived metrics (load factor, growth, international share) and its ' +
      'score breakdown, or why it is not ranked.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'IATA airport code, e.g. "SFO".' },
      },
      required: ['code'],
    },
  },
  {
    name: 'compare_airports',
    description:
      'Side-by-side data for 2-5 airports (same fields as get_airport). ' +
      'Use for any comparison question.',
    input_schema: {
      type: 'object',
      properties: {
        codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'IATA codes, e.g. ["LAX", "SNA"].',
        },
      },
      required: ['codes'],
    },
  },
  {
    name: 'get_long_haul_share',
    description:
      'Share of departing flights from an airport that fly long-haul routes ' +
      '(route distance >= threshold, default 3000 statute miles), reported separately ' +
      'for all flights, passenger flights and cargo flights, plus the top long-haul ' +
      'destinations. Based on 2025 BTS T-100 route data. Always state the threshold used; ' +
      'definitions of long-haul vary.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'IATA airport code, e.g. "ANC".' },
        threshold_miles: {
          type: 'number',
          description: 'Minimum route distance for long-haul. Default 3000.',
        },
      },
      required: ['code'],
    },
  },
];

/** Maps a tool call from Claude to the real (deterministic) service method. */
export function runTool(
  name: string,
  input: unknown,
  airports: AirportsService,
): unknown {
  const args = (input ?? {}) as Record<string, unknown>;

  switch (name) {
    case 'rank_airports': {
      const options = args as RankOptions;
      return airports.rank({
        ...options,
        limit: Math.min(options.limit ?? 10, 25),
      });
    }
    case 'get_airport':
      return airports.getAirport(String(args.code));
    case 'compare_airports':
      return airports.compare((args.codes as string[]).slice(0, 5)); //guardrail: limit to 5 airports
    case 'get_long_haul_share':
      return airports.getLongHaul(
        String(args.code),
        args.threshold_miles as number | undefined,
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Rounds decimals to 3 places and drops undefined fields before sending
 * tool output to the LLM: fewer tokens and easier to read.
 */
export function compact(value: unknown): unknown {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : Math.round(value * 1000) / 1000;
  }
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, compact(v)]),
    );
  }
  return value;
}
