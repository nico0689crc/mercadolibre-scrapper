import { registerAs } from '@nestjs/config';

export interface SearchConfig {
  braveApiKey: string;
  braveApiUrl: string;
  /**
   * Corte duro de consultas por mes. El credito gratis de Brave son 1000;
   * el default deja margen para no descubrir el limite por la facturacion.
   */
  braveMonthlyQuota: number;
}

export const searchConfig = registerAs('search', (): SearchConfig => ({
  braveApiKey: process.env.BRAVE_API_KEY ?? '',
  braveApiUrl:
    process.env.BRAVE_API_URL ?? 'https://api.search.brave.com/res/v1',
  braveMonthlyQuota: parseInt(process.env.BRAVE_MONTHLY_QUOTA ?? '900', 10),
}));
