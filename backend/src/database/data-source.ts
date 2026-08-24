import { config } from 'dotenv';
import { DataSource } from 'typeorm';

import {
  Brand,
  Category,
  CategoryBrand,
  CrawlerState,
  Product,
  ScanRun,
} from './entities';

// Solo para el CLI de TypeORM (generar y correr migraciones). La app usa
// DatabaseModule, que toma la config del ConfigService.
config({ path: ['.env.local', '.env'] });

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5434', 10),
  username: process.env.DATABASE_USER ?? 'scrapper',
  password: process.env.DATABASE_PASSWORD ?? 'scrapper',
  database: process.env.DATABASE_NAME ?? 'scrapper',
  entities: [Brand, Category, CategoryBrand, CrawlerState, Product, ScanRun],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
