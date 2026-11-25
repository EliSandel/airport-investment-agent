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