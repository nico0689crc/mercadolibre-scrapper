import { registerAs } from '@nestjs/config';

export interface AppConfig {
  env: string;
  port: number;
  frontendUrl: string;
  publicUrl: string;
}

export const appConfig = registerAs('app', (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4100', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3100',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:4100',
}));
