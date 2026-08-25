import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Brand,
  Category,
  CategoryBrand,
  CrawlerState,
  Manual,
  ManualCrawlerState,
  Manufacturer,
  Product,
  ScanRun,
  SearchQuota,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('database.url');
        const isDev = config.get<string>('app.env') === 'development';

        return {
          type: 'postgres' as const,
          // En Railway la base llega como DATABASE_URL; en local, por partes.
          ...(url
            ? { url }
            : {
                host: config.get<string>('database.host'),
                port: config.get<number>('database.port'),
                username: config.get<string>('database.username'),
                password: config.get<string>('database.password'),
                database: config.get<string>('database.database'),
              }),
          // Railway solo lo exige por el proxy externo, no en la red interna.
          ssl: config.get<boolean>('database.ssl')
            ? { rejectUnauthorized: false }
            : undefined,
          entities: [
            Brand,
            Category,
            CategoryBrand,
            CrawlerState,
            Manual,
            ManualCrawlerState,
            Manufacturer,
            Product,
            ScanRun,
            SearchQuota,
          ],
          // El esquema lo manejan las migraciones, nunca synchronize.
          synchronize: false,
          migrationsRun: true,
          migrations: [__dirname + '/migrations/*.{ts,js}'],
          retryAttempts: 10,
          retryDelay: 3000,
          logging: isDev ? (['error', 'warn'] as const) : (['error'] as const),
        };
      },
    }),
  ],
})
export class DatabaseModule {}
