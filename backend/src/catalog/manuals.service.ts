import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Manual, Manufacturer } from '../database/entities';
import {
  ManualFinderService,
  normalizeModel,
} from '../search/manual-finder.service';

export interface CrawlReport {
  brand: string;
  domain: string;
  strategy: string;
  pagesVisited: number;
  found: number;
  /** Cuantos de los encontrados matchean un modelo que tenemos en la base. */
  matched: number;
  stored: number;
  skippedByWindow: boolean;
}

@Injectable()
export class ManualsService {
  private readonly logger = new Logger(ManualsService.name);

  constructor(
    @InjectRepository(Manual)
    private readonly manuals: Repository<Manual>,
    @InjectRepository(Manufacturer)
    private readonly manufacturers: Repository<Manufacturer>,
    private readonly finder: ManualFinderService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Recorre el sitio oficial de un fabricante y guarda los manuales de los
   * modelos que tenemos. Guarda tambien que estrategia funciono, para que la
   * proxima corrida no vuelva a tantear.
   */
  async crawlBrand(brandId: string, verify = true): Promise<CrawlReport> {
    const manufacturer = await this.manufacturers.findOne({
      where: { brandId },
      relations: { brand: true },
    });

    if (!manufacturer) {
      throw new NotFoundException(
        `La marca ${brandId} no esta en manufacturers`,
      );
    }
    const domain = manufacturer.officialDomains[0];
    if (!domain) {
      throw new NotFoundException(
        `${manufacturer.brand.name} no tiene dominio oficial. Aceptala primero con uno.`,
      );
    }

    const outcome = await this.finder.crawl(domain, manufacturer.crawlStrategy);

    // Solo interesan los modelos que efectivamente vendemos.
    const ours = await this.modelsOf(brandId);
    const matched = outcome.manuals.filter((m) => ours.has(m.model));

    let stored = 0;
    for (const found of matched) {
      const checked = verify ? await this.finder.verify(found.url) : null;
      if (verify && !checked?.ok) continue;

      await this.dataSource.query(
        `INSERT INTO manuals
           (brand_id, model, model_raw, url, source_domain, found_at_url,
            content_type, bytes, sha256, verified, checked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
         ON CONFLICT (brand_id, model) DO UPDATE SET
           url = EXCLUDED.url,
           model_raw = EXCLUDED.model_raw,
           found_at_url = EXCLUDED.found_at_url,
           content_type = EXCLUDED.content_type,
           bytes = EXCLUDED.bytes,
           sha256 = EXCLUDED.sha256,
           verified = EXCLUDED.verified,
           checked_at = now(),
           updated_at = now()`,
        [
          brandId,
          found.model,
          found.modelRaw,
          found.url,
          domain,
          found.foundAtUrl,
          checked?.contentType ?? null,
          checked?.bytes ?? null,
          checked?.sha256 ?? null,
          checked?.ok ?? false,
        ],
      );
      stored += 1;
    }

    if (!outcome.skippedByWindow) {
      manufacturer.crawlStrategy = outcome.strategy;
      manufacturer.crawlConfig = outcome.config;
      manufacturer.crawledAt = new Date();
      manufacturer.manualsFound = await this.manuals.count({
        where: { brandId },
      });
      await this.manufacturers.save(manufacturer);
    }

    const report: CrawlReport = {
      brand: manufacturer.brand.name,
      domain,
      strategy: outcome.strategy,
      pagesVisited: outcome.pagesVisited,
      found: outcome.manuals.length,
      matched: matched.length,
      stored,
      skippedByWindow: outcome.skippedByWindow,
    };

    this.logger.log(
      `${report.brand}: ${report.found} manuales en el sitio, ${report.matched} matchean, ${report.stored} guardados`,
    );
    return report;
  }

  /** Modelos normalizados que tenemos para esa marca. */
  private async modelsOf(brandId: string): Promise<Set<string>> {
    const rows = await this.dataSource.query<{ modelo: string }[]>(
      `SELECT DISTINCT (SELECT a->>'value_name' FROM jsonb_array_elements(p.attributes) a
                         WHERE a->>'id' = 'MODEL') AS modelo
       FROM products p WHERE p.brand_id = $1`,
      [brandId],
    );

    return new Set(
      rows
        .map((r) => (r.modelo ? normalizeModel(r.modelo) : ''))
        .filter((m) => m.length >= 4),
    );
  }

  list(brandId?: string) {
    const qb = this.manuals
      .createQueryBuilder('m')
      .innerJoin('m.brand', 'b')
      .select([
        'm.id AS id',
        'b.name AS brand',
        'm.model AS model',
        'm.model_raw AS "modelRaw"',
        'm.url AS url',
        'm.source_domain AS "sourceDomain"',
        'm.bytes AS bytes',
        'm.verified AS verified',
        'm.checked_at AS "checkedAt"',
      ])
      .orderBy('b.name', 'ASC')
      .addOrderBy('m.model', 'ASC');

    if (brandId) qb.where('m.brand_id = :brandId', { brandId });
    return qb.getRawMany();
  }

  async stats() {
    const [total, verified, brands] = await Promise.all([
      this.manuals.count(),
      this.manuals.count({ where: { verified: true } }),
      this.manuals
        .createQueryBuilder('m')
        .select('count(DISTINCT m.brand_id)', 'n')
        .getRawOne<{ n: string }>(),
    ]);
    return { total, verified, brands: Number(brands?.n ?? 0) };
  }
}
