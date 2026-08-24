import { registerAs } from '@nestjs/config';

export interface AppConfig {
  env: string;
  port: number;
  frontendUrl: string;
  publicUrl: string;
  /**
   * Interfaz en la que escucha. En Railway la red privada de entornos legacy
   * es solo IPv6: ahi hay que poner '::' o el servicio no es alcanzable.
   */
  bindHost: string;
  /** Sincronizar el arbol de categorias al arrancar si la base esta vacia. */
  seedOnBoot: string;
  seedDepth: number;
  /** Prender el crawler solo al arrancar. */
  crawlerAutostart: string;
  crawlerStrategy: string;
  crawlerSeeds: number;
  crawlerPages: number;
  crawlerDelaySeconds: number;
}

export const appConfig = registerAs('app', (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4100', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3100',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:4100',
  bindHost: process.env.BIND_HOST ?? '0.0.0.0',
  seedOnBoot: process.env.SEED_ON_BOOT ?? 'false',
  seedDepth: parseInt(process.env.SEED_DEPTH ?? '2', 10),
  crawlerAutostart: process.env.CRAWLER_AUTOSTART ?? 'false',
  crawlerStrategy: process.env.CRAWLER_STRATEGY ?? 'catalog',
  crawlerSeeds: parseInt(process.env.CRAWLER_SEEDS ?? '6', 10),
  crawlerPages: parseInt(process.env.CRAWLER_PAGES ?? '6', 10),
  crawlerDelaySeconds: parseInt(process.env.CRAWLER_DELAY_SECONDS ?? '60', 10),
}));
