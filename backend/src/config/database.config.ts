import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5434', 10),
  username: process.env.DATABASE_USER ?? 'scrapper',
  password: process.env.DATABASE_PASSWORD ?? 'scrapper',
  database: process.env.DATABASE_NAME ?? 'scrapper',
}));
