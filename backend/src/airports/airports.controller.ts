import { AirportsService } from './airports.service';
import { Controller, Get, Param, Query } from '@nestjs/common';

/** Debug/inspection endpoints. The agent calls the service directly. */
@Controller('airports')
export class AirportsController {
  constructor(private readonly airports: AirportsService) {}

  // GET /airports/rank?states=MA,CT&limit=5
  @Get('rank')
  rank(@Query('states') states?: string, @Query('limit') limit?: string) {
    return this.airports.rank({
      states: states ? states.split(',') : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // GET /airports/BOS
  @Get(':code')
  get(@Param('code') code: string) {
    return this.airports.getAirport(code);
  }
}