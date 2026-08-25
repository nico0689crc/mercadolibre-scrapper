import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { ManualCrawlerState } from '../database/entities';
import { BraveSearchService } from '../search/brave-search.service';
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
/**
 * Modelos que se buscan en la web por marca en cada pasada. Cada uno gasta una
 * consulta del cupo gratuito de Brave, asi que va de a poco: el worker corre
 * siempre y lo que importa es no quedarse sin cupo a mitad de mes.
 */
const SEARCH_PER_TICK = 3;
/**
 * Fraccion del cupo mensual que el worker puede gastar solo. El resto queda
 * reservado para lo que se pida a mano desde el dashboard.
 */
const SEARCH_QUOTA_CEILING = 0.7;

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
  /** Cupo de busqueda: cuanto se gasto y hasta donde puede gastar el worker. */
  search: { used: number; quota: number; ceiling: number };
}

@Injectable()
export class ManualCrawlerService {
  private readonly logger = new Logger(ManualCrawlerService.name);
  private running = false;
  /** Marcas postergadas por ventana horaria, con su momento de reintento. */
  private readonly deferred = new Map<string, number>();
  /** Por que marca sigue la busqueda cuando ya no queda nada que recorrer. */
  private searchCursor = 0;

  constructor(
    @InjectRepository(ManualCrawlerState)
    private readonly state: Repository<ManualCrawlerState>,
    private readonly manuals: ManualsService,
    private readonly brave: BraveSearchService,
    private readonly dataSource: DataSource,
  ) {}

  @Interval(TICK_MS)
  async tick(): Promise<void> {
    if (this.running) return;

    const state = await this.getState();
    if (!state.enabled) return;

    const next = await this.nextBrand(state.restaleDays, this.readyToRetry());
    if (!next) {
      // Ya se recorrieron todos los sitios y ninguno vuelve a estar viejo hasta
      // dentro de `restaleDays`. El tick no se desperdicia: se gasta buscando
      // en la web los modelos que el recorrido no resolvio, que son la enorme
      // mayoria y no dependen de que el sitio del fabricante cambie.
      this.running = true;
      try {
        await this.searchPass();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Fallo la busqueda de manuales: ${message}`);
      } finally {
        this.running = false;
      }
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
        // El sitio del fabricante no alcanza: hay marcas que publican en un
        // subdominio no enlazado, en un CDN de otro pais o directamente no
        // publican. Buscar el modelo en la web los encuentra igual.
        await this.searchSome(next.brand_id, report.brand);
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

  /**
   * Reparte la busqueda entre los fabricantes, empezando por los que menos
   * manuales tienen. El cursor rota para que el primero de la lista no acapare
   * el cupo tick tras tick mientras los demas nunca llegan.
   */
  private async searchPass(): Promise<void> {
    const brands = await this.dataSource.query<
      { brand_id: string; name: string }[]
    >(
      `SELECT mf.brand_id, b.name
       FROM manufacturers mf
       JOIN brands b ON b.id = mf.brand_id
       WHERE mf.status = 'verified'
       ORDER BY mf.manuals_found ASC, b.name ASC`,
    );
    if (brands.length === 0) return;

    for (let i = 0; i < brands.length; i++) {
      const brand = brands[(this.searchCursor + i) % brands.length];
      const searched = await this.searchSome(brand.brand_id, brand.name);
      if (searched) {
        this.searchCursor = (this.searchCursor + i + 1) % brands.length;
        return;
      }
    }

    this.logger.log(
      'No queda ningun modelo por buscar en los fabricantes verificados',
    );
  }

  /**
   * Gasta unas pocas consultas buscando modelos sueltos, si queda cupo.
   * Devuelve si llego a buscar algo, para poder pasar a la marca siguiente.
   */
  private async searchSome(
    brandId: string,
    brandName: string,
  ): Promise<boolean> {
    const { used, quota } = await this.brave.usage();
    const ceiling = Math.floor(quota * SEARCH_QUOTA_CEILING);
    if (used >= ceiling) {
      this.logger.log(
        `${brandName}: no se busca en la web, el worker ya gasto ${used}/${ceiling} del cupo`,
      );
      return false;
    }

    const report = await this.manuals.searchMissing(
      brandId,
      Math.min(SEARCH_PER_TICK, ceiling - used),
    );
    if (report.tried === 0) return false;

    this.logger.log(
      `${brandName}: busque ${report.tried} modelos en la web, ${report.verified} manuales confirmados`,
    );
    return true;
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
    const [pending, done, stats, quota] = await Promise.all([
      this.countPending(state.restaleDays),
      this.countDone(state.restaleDays),
      this.manuals.stats(),
      this.brave.usage(),
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
      search: {
        used: quota.used,
        quota: quota.quota,
        ceiling: Math.floor(quota.quota * SEARCH_QUOTA_CEILING),
      },
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
