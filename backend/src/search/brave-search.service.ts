import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';

import { SearchQuota } from '../database/entities';

export interface BraveResult {
  url: string;
  title: string;
  description: string;
}

interface BraveResponse {
  web?: { results?: { url: string; title: string; description: string }[] };
}

/** Brave limita a 1 consulta/segundo en el plan con credito gratis. */
const MIN_INTERVAL_MS = 1100;

/**
 * Cliente de Brave Search con corte de cupo.
 *
 * El credito gratis son 1000 consultas al mes. El contador vive en la base y
 * no en memoria: si viviera en memoria, cada reinicio lo pondria en cero y el
 * corte no serviria para nada.
 */
@Injectable()
export class BraveSearchService {
  private readonly logger = new Logger(BraveSearchService.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly monthlyQuota: number;
  private lastCallAt = 0;

  constructor(
    @InjectRepository(SearchQuota)
    private readonly quota: Repository<SearchQuota>,
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('search.braveApiKey', '');
    this.apiUrl = config.get<string>('search.braveApiUrl')!;
    this.monthlyQuota = config.get<number>('search.braveMonthlyQuota', 900);
  }

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  /** Consumo del mes en curso, para mostrarlo antes de gastar. */
  async usage(): Promise<{ used: number; quota: number; period: string }> {
    const period = currentPeriod();
    const row = await this.quota.findOne({
      where: { provider: 'brave', period },
    });
    return { used: row?.used ?? 0, quota: this.monthlyQuota, period };
  }

  async search(query: string, count = 5): Promise<BraveResult[]> {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Falta BRAVE_API_KEY: sin eso no se puede resolver el sitio oficial',
      );
    }

    await this.consumeQuota();
    await this.throttle();

    const params = new URLSearchParams({
      q: query,
      country: 'ar',
      count: String(count),
    });

    try {
      const { data } = await firstValueFrom(
        this.http.get<BraveResponse>(
          `${this.apiUrl}/web/search?${params.toString()}`,
          {
            headers: {
              'X-Subscription-Token': this.apiKey,
              Accept: 'application/json',
            },
          },
        ),
      );
      return data.web?.results ?? [];
    } catch (error) {
      const status = (error as AxiosError).response?.status;
      if (status === 429) {
        throw new HttpException('Brave devolvio 429: bajar el ritmo', 429);
      }
      this.logger.error(`Busqueda fallo (${status ?? 'sin status'}): ${query}`);
      throw new ServiceUnavailableException(`La busqueda fallo: ${query}`);
    }
  }

  /**
   * Reserva una consulta del cupo del mes. El UPDATE condicional hace la
   * comprobacion y el incremento en una sola sentencia, asi dos llamadas
   * concurrentes no pueden pasarse del limite entre el chequeo y la suma.
   */
  private async consumeQuota(): Promise<void> {
    const period = currentPeriod();

    const rows = await this.quota.query<{ used: number }[]>(
      `INSERT INTO search_quota (provider, period, used)
       VALUES ('brave', $1, 1)
       ON CONFLICT (provider, period) DO UPDATE
         SET used = search_quota.used + 1, updated_at = now()
         WHERE search_quota.used < $2
       RETURNING used`,
      [period, this.monthlyQuota],
    );

    if (rows.length === 0) {
      throw new HttpException(
        `Cupo mensual de Brave agotado (${this.monthlyQuota} consultas en ${period}). Se reinicia el mes que viene.`,
        429,
      );
    }
  }

  /** Espacia las llamadas: el plan gratis tolera ~1 por segundo. */
  private async throttle(): Promise<void> {
    const wait = this.lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastCallAt = Date.now();
  }
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
