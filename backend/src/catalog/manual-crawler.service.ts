import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { ManualCrawlerState } from '../database/entities';
import { ManualsService } from './manuals.service';

/**
 * Despierta cada 2 minutos. El intervalo es holgado a proposito: este worker
 * espera horas, no segundos, porque varios fabricantes solo aceptan visitas en
 * una franja horaria (drean.com.ar pide 04:00-08:45 UTC).
 */
const TICK_MS = 120_000;
/**
 * Cuanto se posterga una marca que quedo fuera de su ventana horaria. Sin esto
 * la que espera bloquea la cola: el worker la volveria a elegir en cada tick,
 * saltearla de nuevo, y nunca llegaria a las demas.
 */
const WINDOW_RETRY_MS = 20 * 60 * 1000;

export interface ManualCrawlerStatus {
  enabled: boolean;
  running: boolean;
  restaleDays: number;
  verify: boolean;
  lastBrandName: string | null;
  lastRunAt: Date | null;
  lastError: string | null;
  waitingForWindow: boolean;
  pending: number;
  done: number;
  manuals: number;
}

@Injectable()
export class ManualCrawlerService {
  private readonly logger = new Logger(ManualCrawlerService.name);
  private running = false;
  /** Marcas postergadas por ventana horaria, con su momento de reintento. */
  private readonly deferred = new Map<string, number>();

  constructor(
    @InjectRepository(ManualCrawlerState)
    private readonly state: Repository<ManualCrawlerState>,
    private readonly manuals: ManualsService,
    private readonly dataSource: DataSource,
  ) {}

  @Interval(TICK_MS)
  async tick(): Promise<void> {
    if (this.running) return;

    const state = await this.getState();
    if (!state.enabled) return;

    const next = await this.nextBrand(state.restaleDays, this.readyToRetry());
    if (!next) {
      // Nada pendiente: se queda encendido y vuelve a mirar en el proximo tick.
      return;
    }

    this.running = true;
    try {
      const report = await this.manuals.crawlBrand(next.brand_id, state.verify);

      // Si el sitio pide una franja horaria y estamos fuera, no se marca como
      // hecho: hay que volver cuando abra.
      await this.state.update(
        { id: 1 },
        {
          lastBrandId: next.brand_id,
          lastBrandName: report.brand,
          lastRunAt: new Date(),
          lastError: null,
          waitingForWindow: report.skippedByWindow,
        },
      );

      if (report.skippedByWindow) {
        // Se posterga para que no acapare la cola mientras espera su franja.
        this.deferred.set(next.brand_id, Date.now() + WINDOW_RETRY_MS);
        this.logger.log(
          `${report.brand}: fuera de su ventana horaria, se reintenta en ${WINDOW_RETRY_MS / 60000} min`,
        );
      } else {
        this.deferred.delete(next.brand_id);
        this.logger.log(
          `${report.brand}: ${report.found} manuales en el sitio, ${report.matched} matchean, ${report.stored} guardados`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fallo el crawl de manuales: ${message}`);
      await this.state.update(
        { id: 1 },
        { lastBrandId: next.brand_id, lastError: message },
      );
    } finally {
      this.running = false;
    }
  }

  async start(settings: {
    restaleDays?: number;
    verify?: boolean;
  }): Promise<ManualCrawlerStatus> {
    const current = await this.getState();
    await this.state.update(
      { id: 1 },
      {
        enabled: true,
        restaleDays: settings.restaleDays ?? current.restaleDays,
        verify: settings.verify ?? current.verify,
        lastError: null,
      },
    );
    return this.status();
  }

  async stop(): Promise<ManualCrawlerStatus> {
    await this.state.update({ id: 1 }, { enabled: false });
    return this.status();
  }

  async status(): Promise<ManualCrawlerStatus> {
    const state = await this.getState();
    const [pending, done, stats] = await Promise.all([
      this.countPending(state.restaleDays),
      this.countDone(state.restaleDays),
      this.manuals.stats(),
    ]);

    return {
      enabled: state.enabled,
      running: this.running,
      restaleDays: state.restaleDays,
      verify: state.verify,
      lastBrandName: state.lastBrandName,
      lastRunAt: state.lastRunAt,
      lastError: state.lastError,
      waitingForWindow: state.waitingForWindow,
      pending,
      done,
      manuals: stats.total,
    };
  }

  private async getState(): Promise<ManualCrawlerState> {
    const existing = await this.state.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.state.save(this.state.create({ id: 1 }));
  }

  /**
   * Solo fabricantes verificados con dominio oficial: sin dominio no hay de
   * donde bajar, y sin verificar no sabemos que el dominio sea el correcto.
   */
  private async nextBrand(
    restaleDays: number,
    exclude: string[],
  ): Promise<{ brand_id: string } | null> {
    const rows = await this.dataSource.query<{ brand_id: string }[]>(
      `SELECT m.brand_id
       FROM manufacturers m
       WHERE m.status = 'verified'
         AND jsonb_array_length(m.official_domains) > 0
         AND (m.crawled_at IS NULL OR m.crawled_at < now() - ($1 || ' days')::interval)
         AND NOT (m.brand_id = ANY($2::uuid[]))
       ORDER BY m.crawled_at ASC NULLS FIRST, m.models DESC
       LIMIT 1`,
      [restaleDays, exclude],
    );
    return rows[0] ?? null;
  }

  /** Devuelve las postergadas que todavia no cumplieron su espera. */
  private readyToRetry(): string[] {
    const now = Date.now();
    for (const [brandId, retryAt] of this.deferred) {
      if (retryAt <= now) this.deferred.delete(brandId);
    }
    return [...this.deferred.keys()];
  }

  private async countPending(restaleDays: number): Promise<number> {
    const rows = await this.dataSource.query<{ n: string }[]>(
      `SELECT count(*)::text AS n FROM manufacturers m
       WHERE m.status = 'verified' AND jsonb_array_length(m.official_domains) > 0
         AND (m.crawled_at IS NULL OR m.crawled_at < now() - ($1 || ' days')::interval)`,
      [restaleDays],
    );
    return Number(rows[0]?.n ?? 0);
  }

  private async countDone(restaleDays: number): Promise<number> {
    const rows = await this.dataSource.query<{ n: string }[]>(
      `SELECT count(*)::text AS n FROM manufacturers m
       WHERE m.status = 'verified' AND m.crawled_at >= now() - ($1 || ' days')::interval`,
      [restaleDays],
    );
    return Number(rows[0]?.n ?? 0);
  }
}
