import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AgentModule } from './agent/agent.module';
import { AirportsModule } from './airports/airports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AgentModule,
    AirportsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
