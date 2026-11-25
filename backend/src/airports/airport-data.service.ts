import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AirportRecord, AirportsFile } from '../data/airport.types';
import { AirportMetrics, computeMetrics } from '../scoring/metrics';

/** Loads the data snapshot once at startup and keeps it in memory. */
@Injectable()
export class AirportDataService implements OnModuleInit {
  private readonly logger = new Logger(AirportDataService.name);

  file: AirportsFile;
  metrics: AirportMetrics[] = [];
  private byCode = new Map<string, AirportRecord>();

  onModuleInit() {
    // npm scripts run from backend/, so the data folder is one level up.
    const path =
      process.env.DATA_PATH ??
      resolve(process.cwd(), '..', 'data', 'airports.json');

    this.file = JSON.parse(readFileSync(path, 'utf-8')) as AirportsFile;
    for (const a of this.file.airports) this.byCode.set(a.code, a);
    this.metrics = this.file.airports.map((a) => computeMetrics(a));

    this.logger.log(
      `Loaded ${this.file.airports.length} airports (snapshot ${this.file.metadata.generatedAt})`,
    );
  }

  getRecord(code: string): AirportRecord | undefined {
    return this.byCode.get(code.toUpperCase());
  }

  getMetrics(code: string): AirportMetrics | undefined {
    return this.metrics.find((m) => m.code === code.toUpperCase());
  }
}