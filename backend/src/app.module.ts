import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { AirportsModule } from './airports/airports.module';

@Module({
  imports: [AirportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
