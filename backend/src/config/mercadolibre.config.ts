import { registerAs } from '@nestjs/config';

export interface MercadoLibreConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  siteId: string;
  authDomain: string;
  apiUrl: string;
  /** Ritmo sostenido de requests a ML, por segundo. */
  rateLimitPerSecond: number;
  /** Rafaga maxima que se permite acumular. */
  rateLimitBurst: number;
}

export const mercadolibreConfig = registerAs(
  'mercadolibre',
  (): MercadoLibreConfig => ({
    clientId: process.env.ML_CLIENT_ID!,
    clientSecret: process.env.ML_CLIENT_SECRET!,
    redirectUri: process.env.ML_REDIRECT_URI!,
    siteId: process.env.ML_SITE_ID!,
    authDomain: process.env.ML_AUTH_DOMAIN!,
    apiUrl: process.env.ML_API_URL!,
    rateLimitPerSecond: parseInt(
      process.env.ML_RATE_LIMIT_PER_SECOND ?? '8',
      10,
    ),
    rateLimitBurst: parseInt(process.env.ML_RATE_LIMIT_BURST ?? '10', 10),
  }),
);
