import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { AirportsModule } from '../airports/airports.module';

@Module({
  imports: [AirportsModule], // gives us AirportsService (it's exported there)
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}