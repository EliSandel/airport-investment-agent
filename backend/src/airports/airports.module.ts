import { Module } from '@nestjs/common';
import { AirportsService } from './airports.service';
import { AirportsController } from './airports.controller';
import { AirportDataService } from './airport-data.service';

@Module({
  controllers: [AirportsController],
  providers: [AirportDataService, AirportsService],
  exports: [AirportsService], // the agent module will need it
})
export class AirportsModule {}