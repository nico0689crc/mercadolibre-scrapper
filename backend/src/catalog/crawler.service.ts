import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CrawlerState } from '../database/entities';
import type { BrandStrategy } from '../mercadolibre/categories/category.types';
import { ScanService } from './scan.service';

/** Cada cuanto despierta el crawler a preguntarse si le toca trabajar. */
const TICK_MS = 5_000;

export interface CrawlerStatus {
  enabled: boolean;
  strategy: string;
  seeds: number;
  pages: number;
  delaySeconds: number;
  restaleDays: number;
  lastCategoryId: string | null;
  lastRunAt: Date | null;
  lastError: string | null;
  running: boolean;
  pending: number;
  done: number;
}

export interface CrawlerSettings {
  strategy?: BrandStrategy;
  seeds?: number;
  pages?: number;
  delaySeconds?: number;
  restaleDays?: number;
}

/**
 * Llena la base de a poco: toma la categoria que hace mas tiempo no se escanea,
 * la escanea y espera. Una categoria por vez, nunca en paralelo — el ritmo lo
 * marca `delaySeconds` y por debajo esta el token bucket de RateLimiterService.
 */
@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private running = false;
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
    if (this.running || Date.now() < this.nextRunAt) return;

    const state = await this.getState();
    if (!state.enabled) return;

    const categoryId = await this.nextCategory(state.restaleDays);
    if (!categoryId) {
      this.logger.log(
        'No queda ninguna categoria por escanear: crawler en pausa',
      );
      await this.state.update({ id: 1 }, { enabled: false, lastError: null });
      return;
    }

    this.running = true;
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
      this.running = false;
      this.nextRunAt = Date.now() + state.delaySeconds * 1000;
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

    return {
      enabled: state.enabled,
      strategy: state.strategy,
      seeds: state.seeds,
      pages: state.pages,
      delaySeconds: state.delaySeconds,
      restaleDays: state.restaleDays,
      lastCategoryId: state.lastCategoryId,
      lastRunAt: state.lastRunAt,
      lastError: state.lastError,
      running: this.running,
      pending,
      done,
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
  private async nextCategory(restaleDays: number): Promise<string | null> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `
      SELECT c.id
      FROM categories c
      LEFT JOIN LATERAL (
        SELECT max(s.created_at) AS last_ok
        FROM scan_runs s
        WHERE s.category_id = c.id AND s.status = 'ok'
      ) s ON true
      WHERE s.last_ok IS NULL OR s.last_ok < now() - ($1 || ' days')::interval
      ORDER BY s.last_ok ASC NULLS FIRST, c.total_items DESC
      LIMIT 1
      `,
      [restaleDays],
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
