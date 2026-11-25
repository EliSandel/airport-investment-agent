/**
 * Shape of data/airports.json, produced by scripts/ingest.ts.
 * Shared by the ingestion script and the backend.
 */

export interface YearStats {
  passengers: number; // departing passengers, all carriers
  seats: number; // seats offered on departing flights
  departures: number;
  intlPassengers: number; // outbound international passengers
  intlSeats: number;
  freightLbs: number;
}

export interface AirportRecord {
  code: string; // IATA code, e.g. "BOS"
  name: string;
  city: string;
  state: string; // e.g. "MA"
  lat: number;
  lon: number;
  years: Record<string, YearStats>; // keyed by year, e.g. "2025"
  delays?: DelayStats; // optional: only airports served by reporting carriers
}

export interface AirportsFile {
  metadata: {
    generatedAt: string;
    years: string[];
    sources: Record<string, string>;
    notes: string[];
  };
  airports: AirportRecord[];
}

export interface DelayStats {
  year: string;
  arrFlights: number; // arriving flights (reporting carriers only)
  arrDel15: number; // arrivals delayed 15+ minutes, any cause
  nasDelayed: number; // arrivals delayed by National Airspace System causes
  nasDelayMinutes: number;
}
