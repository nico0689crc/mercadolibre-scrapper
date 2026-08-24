import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Token bucket global para todas las llamadas a la API de ML.
 *
 * ML no publica un RPM concreto: la doc dice que el limite se aplica por Client ID
 * y por endpoint, y que hay que detectar el 429 y espaciar. Como no hay numero,
 * el enfoque es autolimitarse a un ritmo conservador y ajustarlo por env.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private tokens: number;
  private lastRefill = Date.now();
  /** Cola de esperas en orden de llegada, para no dejar a nadie sin turno. */
  private queue: (() => void)[] = [];
  private draining = false;

  constructor(config: ConfigService) {
    this.capacity = config.get<number>('mercadolibre.rateLimitBurst', 10);
    const perSecond = config.get<number>('mercadolibre.rateLimitPerSecond', 8);
    this.refillPerMs = perSecond / 1000;
    this.tokens = this.capacity;
  }

  /** Espera hasta tener permiso para hacer una request. */
  acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1 && this.queue.length === 0) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.drain();
    });
  }

  /** Penaliza tras un 429: vacia el bucket para frenar en seco. */
  penalize(): void {
    this.tokens = 0;
    this.lastRefill = Date.now();
    this.logger.warn('429 de ML: bucket vaciado, bajando el ritmo');
  }

  private refill(): void {
    const now = Date.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (now - this.lastRefill) * this.refillPerMs,
    );
    this.lastRefill = now;
  }

  private drain(): void {
    if (this.draining) return;
    this.draining = true;

    const tick = () => {
      this.refill();

      while (this.tokens >= 1 && this.queue.length > 0) {
        this.tokens -= 1;
        this.queue.shift()!();
      }

      if (this.queue.length === 0) {
        this.draining = false;
        return;
      }
      // Cuanto falta para el proximo token, con un piso de 10ms.
      const waitMs = Math.max(
        10,
        Math.ceil((1 - this.tokens) / this.refillPerMs),
      );
      setTimeout(tick, waitMs);
    };

    tick();
  }
}
