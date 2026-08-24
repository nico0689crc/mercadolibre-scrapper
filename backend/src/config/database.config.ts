import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  /** Si viene, gana sobre host/port/user/pass/name. Railway inyecta DATABASE_URL. */
  url: string | null;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  url: process.env.DATABASE_URL || null,
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5434', 10),
  username: process.env.DATABASE_USER ?? 'scrapper',
  password: process.env.DATABASE_PASSWORD ?? 'scrapper',
  database: process.env.DATABASE_NAME ?? 'scrapper',
  // Railway solo lo exige en conexiones externas (proxy), no en la red interna.
  ssl: process.env.DATABASE_SSL === 'true',
}));
