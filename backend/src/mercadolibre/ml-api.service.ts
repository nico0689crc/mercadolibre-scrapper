import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import { MlAuthService } from './ml-auth.service';
import { RateLimiterService } from './rate-limiter.service';

/** Reintentos ante 429 antes de rendirse. */
const MAX_RETRIES_429 = 4;
/** Base del backoff exponencial, en ms. */
const BACKOFF_BASE_MS = 1000;
/** Reintentos ante un fallo de red (no de ML) antes de rendirse. */
const MAX_RETRIES_NETWORK = 3;
/**
 * Fallos de transporte que se resuelven solos: DNS saturado, timeout, socket
 * cortado. Con varias categorias en paralelo aparecen sin que ML tenga la culpa.
 */
const RETRYABLE_CODES = new Set([
  'ECONNABORTED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'ERR_SOCKET_CONNECTION_TIMEOUT',
]);

/** Cliente HTTP contra api.mercadolibre.com: token, rate limit y traduccion de errores. */
@Injectable()
export class MlApiService {
  private readonly logger = new Logger(MlApiService.name);
  private readonly apiUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly auth: MlAuthService,
    private readonly limiter: RateLimiterService,
    config: ConfigService,
  ) {
    this.apiUrl = config.get<string>('mercadolibre.apiUrl')!;
  }

  async get<T>(path: string): Promise<T> {
    let attempt = 0;
    let networkAttempt = 0;
    let refreshed = false;

    for (;;) {
      await this.limiter.acquire();
      const token = await this.auth.getAppToken();

      try {
        const { data } = await firstValueFrom(
          this.http.get<T>(`${this.apiUrl}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        );
        return data;
      } catch (error) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;

        // Token revocado o vencido antes de tiempo: renovar y reintentar una vez.
        if (status === 401 && !refreshed) {
          refreshed = true;
          this.auth.invalidate();
          continue;
        }

        // ML no publica un RPM: la doc pide detectar el 429 y espaciar con
        // backoff exponencial mas jitter. Respetamos Retry-After si viene.
        if (status === 429 && attempt < MAX_RETRIES_429) {
          this.limiter.penalize();
          const waitMs = this.backoffMs(attempt, axiosError);
          this.logger.warn(
            `429 en ${path}: reintento ${attempt + 1}/${MAX_RETRIES_429} en ${waitMs}ms`,
          );
          await this.sleep(waitMs);
          attempt += 1;
          continue;
        }

        // Fallo de transporte: no gasta cupo del rate limit, solo espaciar.
        if (
          !axiosError.response &&
          RETRYABLE_CODES.has(axiosError.code ?? '') &&
          networkAttempt < MAX_RETRIES_NETWORK
        ) {
          const waitMs = this.backoffMs(networkAttempt, axiosError);
          this.logger.warn(
            `${axiosError.code} en ${path}: reintento ${networkAttempt + 1}/${MAX_RETRIES_NETWORK} en ${waitMs}ms`,
          );
          await this.sleep(waitMs);
          networkAttempt += 1;
          continue;
        }

        throw this.translate(axiosError, path);
      }
    }
  }

  private backoffMs(attempt: number, error: AxiosError): number {
    const retryAfter = Number(error.response?.headers?.['retry-after']);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return retryAfter * 1000;
    }
    const exponential = BACKOFF_BASE_MS * 2 ** attempt;
    // Jitter completo: evita que varios workers reintenten en el mismo instante.
    return Math.round(exponential * (0.5 + Math.random() * 0.5));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private translate(error: AxiosError, path: string): HttpException {
    const status = error.response?.status;

    if (status === 404) {
      return new NotFoundException(
        `Recurso no encontrado en Mercado Libre: ${path}`,
      );
    }
    if (status === 403) {
      // ML restringio varios recursos publicos (por ejemplo /sites/{id}/search).
      return new HttpException(
        `Mercado Libre rechazo el acceso a ${path}. El token de aplicacion no alcanza para este recurso.`,
        403,
      );
    }
    if (status === 429) {
      return new HttpException(
        `Rate limit de Mercado Libre alcanzado en ${path} tras ${MAX_RETRIES_429} reintentos`,
        429,
      );
    }

    this.logger.error(
      `GET ${path} fallo: ${status ?? error.code ?? 'sin status'}`,
    );
    return new BadGatewayException(`Error consultando Mercado Libre: ${path}`);
  }
}
