import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface HealthStatus {
  status: 'ok';
  env: string;
  siteId: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      env: this.config.get<string>('app.env', 'development'),
      siteId: this.config.get<string>('mercadolibre.siteId', 'MLA'),
      timestamp: new Date().toISOString(),
    };
  }
}
