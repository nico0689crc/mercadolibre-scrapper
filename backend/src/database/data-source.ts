import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import {
  Brand,
  Category,
  CategoryBrand,
  CrawlerState,
  Manufacturer,
  Product,
  ScanRun,
  SearchQuota,
} from './entities';

// Solo para el CLI de TypeORM (generar y correr migraciones). La app usa
// DatabaseModule, que toma la config del ConfigService.
config({ path: ['.env.local', '.env'] });

export default new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DATABASE_HOST ?? 'localhost',
        port: parseInt(process.env.DATABASE_PORT ?? '5434', 10),
        username: process.env.DATABASE_USER ?? 'scrapper',
        password: process.env.DATABASE_PASSWORD ?? 'scrapper',
        database: process.env.DATABASE_NAME ?? 'scrapper',
      }),
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
  entities: [
    Brand,
    Category,
    CategoryBrand,
    CrawlerState,
    Manufacturer,
    Product,
    ScanRun,
    SearchQuota,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
