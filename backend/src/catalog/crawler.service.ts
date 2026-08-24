import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CrawlerState } from '../database/entities';
import type { BrandStrategy } from '../mercadolibre/categories/category.types';
import { ScanService } from './scan.service';

/** Cada cuanto despierta el crawler a preguntarse si le toca trabajar. */
const TICK_MS = 5_000;
/**
 * Tope del sueño cuando no hay nada pendiente. Aunque la proxima pasada sea
 * dentro de una semana, vuelve a mirar cada tanto: si aparecen categorias
 * nuevas (un sync con mas profundidad) no tienen que esperar toda la semana.
 */
const IDLE_RECHECK_MS = 10 * 60 * 1000;

export interface CrawlerStatus {
  enabled: boolean;
  strategy: string;
  seeds: number;
  pages: number;
  delaySeconds: number;
  concurrency: number;
  /** Categorias que se estan escaneando en este momento. */
  inFlight: string[];
  restaleDays: number;
  lastCategoryId: string | null;
  lastRunAt: Date | null;
  lastError: string | null;
  running: boolean;
  pending: number;
  done: number;
  /**
   * Cuando arranca la proxima pasada. Se llena cuando ya no queda nada
   * pendiente: es el momento en que la categoria mas vieja cumple `restaleDays`.
   */
  nextPassAt: Date | null;
}

export interface CrawlerSettings {
  strategy?: BrandStrategy;
  seeds?: number;
  pages?: number;
  delaySeconds?: number;
  restaleDays?: number;
  concurrency?: number;
}

/**
 * Llena la base de a poco: toma la categoria que hace mas tiempo no se escanea,
 * la escanea y espera. Una categoria por vez, nunca en paralelo — el ritmo lo
 * marca `delaySeconds` y por debajo esta el token bucket de RateLimiterService.
 */
@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  /** Categorias en vuelo. Evita que dos tandas tomen la misma. */
  private readonly inFlight = new Set<string>();
  private nextRunAt = 0;

  constructor(
    @InjectRepository(CrawlerState)
    private readonly state: Repository<CrawlerState>,
    private readonly scans: ScanService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.getState();
  }

  @Interval(TICK_MS)
  async tick(): Promise<void> {
    if (Date.now() < this.nextRunAt) return;

    const state = await this.getState();
    if (!state.enabled) return;

    let lanzadas = 0;

    // Llena los slots libres. Cada scan corre por su cuenta; el ritmo real lo
    // acota el token bucket de RateLimiterService, que es global a toda la app.
    while (this.inFlight.size < state.concurrency) {
      const categoryId = await this.nextCategory(state.restaleDays, [
        ...this.inFlight,
      ]);

      if (!categoryId) {
        // Terminó una pasada completa. No se apaga: queda dormido hasta que la
        // categoria mas vieja cumpla `restaleDays` y ahi arranca la siguiente.
        if (this.inFlight.size === 0 && lanzadas === 0) {
          await this.sleepUntilNextPass(state.restaleDays);
        }
        break;
      }

      this.inFlight.add(categoryId);
      lanzadas += 1;
      void this.scanOne(categoryId, state);
    }

    if (lanzadas > 0) {
      this.nextRunAt = Date.now() + state.delaySeconds * 1000;
    }
  }

  private async scanOne(
    categoryId: string,
    state: CrawlerState,
  ): Promise<void> {
    try {
      const run = await this.scans.run(categoryId, {
        strategy: state.strategy as BrandStrategy,
        seeds: state.seeds,
        pages: state.pages,
      });

      await this.state.update(
        { id: 1 },
        {
          lastCategoryId: categoryId,
          lastRunAt: new Date(),
          lastError: run.status === 'error' ? run.error : null,
        },
      );

      this.logger.log(
        `${categoryId}: ${run.brandsFound} marcas (${run.brandsNew} nuevas), ${run.productsStored} productos`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Crawler fallo en ${categoryId}: ${message}`);
      await this.state.update(
        { id: 1 },
        { lastCategoryId: categoryId, lastError: message },
      );
    } finally {
      this.inFlight.delete(categoryId);
    }
  }

  async start(settings: CrawlerSettings): Promise<CrawlerStatus> {
    const current = await this.getState();
    await this.state.update(
      { id: 1 },
      {
        enabled: true,
        strategy: settings.strategy ?? current.strategy,
        seeds: settings.seeds ?? current.seeds,
        pages: settings.pages ?? current.pages,
        delaySeconds: settings.delaySeconds ?? current.delaySeconds,
        restaleDays: settings.restaleDays ?? current.restaleDays,
        concurrency: settings.concurrency ?? current.concurrency,
        lastError: null,
      },
    );
    // Que arranque en el proximo tick, sin arrastrar la espera anterior.
    this.nextRunAt = 0;
    return this.status();
  }

  async stop(): Promise<CrawlerStatus> {
    await this.state.update({ id: 1 }, { enabled: false });
    return this.status();
  }

  async status(): Promise<CrawlerStatus> {
    const state = await this.getState();
    const [pending, done] = await Promise.all([
      this.countPending(state.restaleDays),
      this.countDone(state.restaleDays),
    ]);

    // Solo tiene sentido informarlo cuando efectivamente no queda nada por hacer.
    const nextPassAt =
      pending === 0 ? await this.nextStaleAt(state.restaleDays) : null;

    return {
      enabled: state.enabled,
      strategy: state.strategy,
      seeds: state.seeds,
      pages: state.pages,
      delaySeconds: state.delaySeconds,
      concurrency: state.concurrency,
      inFlight: [...this.inFlight],
      restaleDays: state.restaleDays,
      lastCategoryId: state.lastCategoryId,
      lastRunAt: state.lastRunAt,
      lastError: state.lastError,
      running: this.inFlight.size > 0,
      pending,
      done,
      nextPassAt,
    };
  }

  private async getState(): Promise<CrawlerState> {
    const existing = await this.state.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.state.save(this.state.create({ id: 1 }));
  }

  /**
   * La proxima categoria: primero las que nunca se escanearon, despues las que
   * tienen el scan mas viejo. A igualdad, la que mas items tiene.
   */
  /**
   * Pone el crawler a dormir hasta la proxima pasada. Sigue `enabled`: lo que
   * cambia es que no vuelve a consultar la base hasta esa fecha.
   */
  private async sleepUntilNextPass(restaleDays: number): Promise<void> {
    const nextPassAt = await this.nextStaleAt(restaleDays);

    if (!nextPassAt) {
      this.nextRunAt = Date.now() + IDLE_RECHECK_MS;
      this.logger.log(
        'Pasada completa. Sin fecha de vencimiento: revisa en 10 min',
      );
      return;
    }

    // Duerme hasta que venza la mas vieja, pero revisando cada IDLE_RECHECK_MS.
    this.nextRunAt = Math.min(
      Math.max(nextPassAt.getTime(), Date.now() + TICK_MS),
      Date.now() + IDLE_RECHECK_MS,
    );
    const horas = Math.round((nextPassAt.getTime() - Date.now()) / 3_600_000);
    this.logger.log(
      `Pasada completa: todas las categorias estan frescas. Proxima pasada en ~${horas}h (${nextPassAt.toISOString()})`,
    );
  }

  /** Cuando vence la categoria escaneada hace mas tiempo. */
  private async nextStaleAt(restaleDays: number): Promise<Date | null> {
    const rows = await this.dataSource.query<{ next_at: Date | null }[]>(
      `
      SELECT min(s.last_ok) + ($1 || ' days')::interval AS next_at
      FROM categories c
      JOIN LATERAL (
        SELECT max(r.created_at) AS last_ok
        FROM scan_runs r
        WHERE r.category_id = c.id AND r.status = 'ok'
      ) s ON true
      WHERE s.last_ok IS NOT NULL
      `,
      [restaleDays],
    );

    return rows[0]?.next_at ?? null;
  }

  private async nextCategory(
    restaleDays: number,
    exclude: string[],
  ): Promise<string | null> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `
      SELECT c.id
      FROM categories c
      LEFT JOIN LATERAL (
        SELECT max(s.created_at) AS last_ok
        FROM scan_runs s
        WHERE s.category_id = c.id AND s.status = 'ok'
      ) s ON true
      WHERE (s.last_ok IS NULL OR s.last_ok < now() - ($1 || ' days')::interval)
        AND NOT (c.id = ANY($2::varchar[]))
      ORDER BY s.last_ok ASC NULLS FIRST, c.total_items DESC
      LIMIT 1
      `,
      [restaleDays, exclude],
    );

    return rows[0]?.id ?? null;
  }

  private async countPending(restaleDays: number): Promise<number> {
    const rows = await this.dataSource.query<{ count: string }[]>(
      `
      SELECT count(*)::text AS count
      FROM categories c
      LEFT JOIN LATERAL (
        SELECT max(s.created_at) AS last_ok
        FROM scan_runs s
        WHERE s.category_id = c.id AND s.status = 'ok'
      ) s ON true
      WHERE s.last_ok IS NULL OR s.last_ok < now() - ($1 || ' days')::interval
      `,
      [restaleDays],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async countDone(restaleDays: number): Promise<number> {
    const rows = await this.dataSource.query<{ count: string }[]>(
      `
      SELECT count(*)::text AS count
      FROM categories c
      JOIN LATERAL (
        SELECT max(s.created_at) AS last_ok
        FROM scan_runs s
        WHERE s.category_id = c.id AND s.status = 'ok'
      ) s ON true
      WHERE s.last_ok >= now() - ($1 || ' days')::interval
      `,
      [restaleDays],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
