/**
 * Ingestion script: builds data/airports.json
 *
 * Run from backend/:   npm run ingest
 *
 * Steps:
 *   1. Fetch yearly passenger / seat totals per airport from the BTS Open Data API (Socrata)
 *   2. Fetch the OurAirports reference table (state, coordinates, name)
 *   3. Read BTS delay causes from a downloaded snapshot (no API exists for it)
 *   4. Join everything on the airport code (US airports only) and save
 *
 * Design note: this script only collects FACTS (raw sums).
 * Derived metrics (load factor, growth, congestion, scores) are computed in the
 * scoring module, so every formula lives in one tested place.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { AirportRecord, DelayStats } from '../src/data/airport.types';

// ---------------------------------------------------------------- config

/** 2023 vs 2025: two post-COVID years, so growth isn't distorted by the 2020-21 collapse. */
const YEARS = ['2023', '2025'];

/** BTS "T-100 Segment Summary By Origin Airport" (one row per airport per month). */
const BTS_URL = 'https://data.transportation.gov/resource/r495-tyji.json';

/** OurAirports public reference data: codes, names, states, coordinates. */
const OURAIRPORTS_URL =
  'https://davidmegginson.github.io/ourairports-data/airports.csv';

/** BTS On-Time "Delay Causes" download (snapshot, no API available). */
const DELAYS_CSV = resolve(__dirname, '../../data/raw/Airline_Delay_Cause.csv');
const DELAY_YEAR = '2025';

const OUTPUT_PATH = resolve(__dirname, '../../data/airports.json');

// ---------------------------------------------------------------- types

/** Shape of one row returned by the BTS API (Socrata returns numbers as strings). */
interface BtsRow {
  origin_airport_code: string;
  year: string;
  passengers?: string;
  seats?: string;
  departures?: string;
  intl_passengers?: string;
  intl_seats?: string;
  freight_lbs?: string;
}

interface AirportInfo {
  name: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  type: string;
}

/** One row of the delay causes CSV: one carrier at one airport in one month. */
interface DelayRow {
  year: string;
  airport: string;
  arr_flights: string;
  arr_del15: string;
  nas_ct: string;
  nas_delay: string;
}

/** Socrata and CSVs give numbers as strings, sometimes empty. */
const num = (v: string | undefined): number => (v ? Number(v) : 0);

// ---------------------------------------------------------------- step 1: BTS API

async function fetchBtsTotals(): Promise<BtsRow[]> {
  // The API sums the months for us, so we download ~2-3k rows instead of 136k.
  const params = new URLSearchParams({
    $select: [
      'origin_airport_code',
      'year',
      'sum(total_passengers) AS passengers',
      'sum(total_seats) AS seats',
      'sum(total_departures) AS departures',
      'sum(outbound_international_1) AS intl_passengers',
      'sum(outbound_international_seats) AS intl_seats',
      'sum(total_freight_lbs) AS freight_lbs',
    ].join(', '),
    $where: `year in (${YEARS.map((y) => `'${y}'`).join(', ')})`,
    $group: 'origin_airport_code, year',
    $limit: '50000',
  });

  const res = await fetch(`${BTS_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`BTS API error ${res.status}: ${await res.text()}`);
  }
  const rows = (await res.json()) as BtsRow[];

  // Safety check: if we got exactly $limit rows, data was probably cut off.
  if (rows.length >= 50000) {
    throw new Error('BTS result hit the row limit; results may be truncated');
  }
  return rows;
}

// ---------------------------------------------------------------- step 2: OurAirports

/** Prefer bigger airports when two entries share the same IATA code. */
const TYPE_RANK: Record<string, number> = {
  large_airport: 3,
  medium_airport: 2,
  small_airport: 1,
};

async function fetchAirportReference(): Promise<Map<string, AirportInfo>> {
  const res = await fetch(OURAIRPORTS_URL);
  if (!res.ok) throw new Error(`OurAirports error ${res.status}`);

  // csv-parse handles quoted fields like "Boston, MA" correctly.
  const rows = parse(await res.text(), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const byCode = new Map<string, AirportInfo>();
  for (const r of rows) {
    if (r.iso_country !== 'US' || !r.iata_code) continue;

    const info: AirportInfo = {
      name: r.name,
      city: r.municipality,
      state: r.iso_region.replace('US-', ''), // "US-MA" -> "MA"
      lat: Number(r.latitude_deg),
      lon: Number(r.longitude_deg),
      type: r.type,
    };
    const existing = byCode.get(r.iata_code);
    if (
      !existing ||
      (TYPE_RANK[info.type] ?? 0) > (TYPE_RANK[existing.type] ?? 0)
    ) {
      byCode.set(r.iata_code, info);
    }
  }
  return byCode;
}

// ---------------------------------------------------------------- step 3: delay causes

/** Sums all carriers and months per airport for DELAY_YEAR. */
function loadDelays(): Map<string, DelayStats> {
  const byAirport = new Map<string, DelayStats>();
  if (!existsSync(DELAYS_CSV)) {
    console.warn(`    ${DELAYS_CSV} not found: skipping delays`);
    return byAirport;
  }

  const rows = parse(readFileSync(DELAYS_CSV, 'utf-8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true, // some BTS exports have spaces in headers/values
  }) as DelayRow[];

  for (const r of rows) {
    if (r.year !== DELAY_YEAR) continue;
    const s = byAirport.get(r.airport) ?? {
      year: DELAY_YEAR,
      arrFlights: 0,
      arrDel15: 0,
      nasDelayed: 0,
      nasDelayMinutes: 0,
    };
    s.arrFlights += num(r.arr_flights);
    s.arrDel15 += num(r.arr_del15);
    s.nasDelayed += num(r.nas_ct);
    s.nasDelayMinutes += num(r.nas_delay);
    byAirport.set(r.airport, s);
  }
  return byAirport;
}

// ---------------------------------------------------------------- step 4: join + save

async function main() {
  console.log('1/4 Fetching BTS totals...');
  const btsRows = await fetchBtsTotals();
  console.log(`    ${btsRows.length} airport-year rows`);

  console.log('2/4 Fetching OurAirports reference data...');
  const reference = await fetchAirportReference();
  console.log(`    ${reference.size} US airports with an IATA code`);

  console.log('3/4 Reading delay causes snapshot...');
  const delays = loadDelays();
  console.log(`    ${delays.size} airports with ${DELAY_YEAR} delay data`);

  console.log('4/4 Joining...');
  const airports = new Map<string, AirportRecord>();
  const unmatched = new Set<string>();

  for (const row of btsRows) {
    const code = row.origin_airport_code;
    const info = reference.get(code);
    if (!info) {
      // Foreign airports, US territories, or codes OurAirports doesn't know.
      unmatched.add(code);
      continue;
    }

    let record = airports.get(code);
    if (!record) {
      record = {
        code,
        name: info.name,
        city: info.city,
        state: info.state,
        lat: info.lat,
        lon: info.lon,
        years: {},
        delays: delays.get(code),
      };
      airports.set(code, record);
    }

    record.years[row.year] = {
      passengers: num(row.passengers),
      seats: num(row.seats),
      departures: num(row.departures),
      intlPassengers: num(row.intl_passengers),
      intlSeats: num(row.intl_seats),
      freightLbs: num(row.freight_lbs),
    };
  }

  // Sort biggest first (by the latest year) so the file is easy to eyeball.
  const latest = YEARS[YEARS.length - 1];
  const sorted = [...airports.values()].sort(
    (a, b) =>
      (b.years[latest]?.passengers ?? 0) - (a.years[latest]?.passengers ?? 0),
  );

  const output = {
    metadata: {
      generatedAt: new Date().toISOString(),
      years: YEARS,
      sources: {
        traffic: `BTS T-100 Segment Summary By Origin Airport (${BTS_URL})`,
        reference: `OurAirports (${OURAIRPORTS_URL})`,
        delays: `BTS Airline On-Time Statistics and Delay Causes, ${DELAY_YEAR} (downloaded snapshot)`,
      },
      notes: [
        'Passengers = departing passengers reported on T-100 by all carriers (about half of total airport traffic).',
        'US airports only (iso_country = US); territories and foreign airports are excluded.',
        'Delays cover arrivals on carriers that report on-time data only.',
      ],
    },
    airports: sorted,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  const withDelays = sorted.filter((a) => a.delays).length;
  console.log(`\nSaved ${sorted.length} airports to ${OUTPUT_PATH}`);
  console.log(`${withDelays} of them have delay data`);
  console.log(
    `Skipped ${unmatched.size} codes not found as US airports, e.g.: ` +
      [...unmatched].slice(0, 10).join(', '),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});