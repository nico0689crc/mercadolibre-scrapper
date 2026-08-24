import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { mercadolibreConfig } from './config/mercadolibre.config';
import { CatalogModule } from './catalog/catalog.module';
import { DatabaseModule } from './database/database.module';
import { MercadoLibreModule } from './mercadolibre/mercadolibre.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, databaseConfig, mercadolibreConfig],
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CatalogModule,
    MercadoLibreModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
