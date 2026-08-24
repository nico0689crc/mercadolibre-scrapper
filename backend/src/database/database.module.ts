import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Brand,
  Category,
  CategoryBrand,
  CrawlerState,
  Product,
  ScanRun,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: [
          Brand,
          Category,
          CategoryBrand,
          CrawlerState,
          Product,
          ScanRun,
        ],
        // El esquema lo manejan las migraciones, nunca synchronize.
        synchronize: false,
        migrationsRun: true,
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        retryAttempts: 10,
        retryDelay: 3000,
        logging:
          config.get<string>('app.env') === 'development'
            ? ['error', 'warn']
            : ['error'],
      }),
    }),
  ],
})
export class DatabaseModule {}
