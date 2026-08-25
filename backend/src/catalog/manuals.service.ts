import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Brand, Manual, Manufacturer } from '../database/entities';
import { BraveSearchService } from '../search/brave-search.service';
import { brandSlug } from './brands-store.service';
import type { ImportManualsDto } from './dto/import-manuals.dto';
import type {
  MatchReason,
  SearchHit,
  VerifiedFile,
} from '../search/manual-finder.service';
import {
  ManualFinderService,
  normalizeModel,
} from '../search/manual-finder.service';

export interface ImportReport {
  recibidos: number;
  guardados: number;
  /** Marcas que el otro entorno tiene y esta base no. */
  sinMarca: string[];
  /** Como quedo el contador del cupo, si se pidio actualizarlo. */
  cupo: { used: number; quota: number; period: string } | null;
}

export interface ManualRow {
  id: string;
  brand: string;
  model: string;
  modelRaw: string;
  url: string;
  sourceDomain: string;
  bytes: number | null;
  matchReason: string | null;
  verified: boolean;
  checkedAt: Date | null;
  /** Producto de la misma marca cuyo modelo coincide, si lo tenemos. */
  productId: string | null;
  productName: string | null;
  /** Cuantos productos comparten ese modelo: el PDF cubre a todos. */
  productCount: number;
}

export interface SearchReport {
  brand: string;
  tried: number;
  found: number;
  verified: number;
  /** Cuantos salieron de un dominio que contiene el nombre de la marca. */
  fromOfficial: number;
  /** De que dominios salieron, para aprender donde buscar despues. */
  domains: Record<string, number>;
  /** Que se encontro modelo por modelo, para poder revisarlo a mano. */
  samples: {
    model: string;
    url: string;
    domain: string;
    official: boolean;
    verified: boolean;
    reason?: MatchReason;
  }[];
  quotaExhausted: boolean;
}

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
    @InjectRepository(Brand)
    private readonly brands: Repository<Brand>,
    private readonly finder: ManualFinderService,
    private readonly brave: BraveSearchService,
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

  /**
   * Busca por modelo los manuales que el crawl del sitio no encontro.
   *
   * Cada modelo cuesta una consulta del cupo, por eso `limit`. Es la via cara
   * pero la que mas cubre: en la muestra que probamos acerto 6 de 6, y en 4 de
   * esos 6 el resultado estaba igual en un dominio oficial que el crawl del
   * sitio no habia encontrado.
   */
  async searchMissing(brandId: string, limit = 10): Promise<SearchReport> {
    const manufacturer = await this.manufacturers.findOne({
      where: { brandId },
      relations: { brand: true },
    });
    if (!manufacturer) {
      throw new NotFoundException(
        `La marca ${brandId} no esta en manufacturers`,
      );
    }

    const pending = await this.modelsWithoutManual(brandId, limit);
    const report: SearchReport = {
      brand: manufacturer.brand.name,
      tried: 0,
      found: 0,
      verified: 0,
      fromOfficial: 0,
      domains: {},
      samples: [],
      quotaExhausted: false,
    };

    for (const modelRaw of pending) {
      let candidates: SearchHit[];
      try {
        report.tried += 1;
        candidates = await this.finder.searchModel(
          manufacturer.brand.name,
          modelRaw,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'error';
        // El cupo mensual se agoto: no tiene sentido seguir intentando.
        report.quotaExhausted = /[Cc]upo mensual/.test(message);
        this.logger.warn(`Corte de busqueda en ${modelRaw}: ${message}`);
        break;
      }

      if (candidates.length === 0) continue;
      report.found += 1;

      // Los candidatos ya vienen ordenados; el primero que baje un PDF real gana.
      let resolved: {
        hit: SearchHit;
        url: string;
        checked: VerifiedFile;
        reason: MatchReason;
      } | null = null;
      for (const hit of candidates.slice(0, 4)) {
        const pdf = await this.finder.resolvePdf(hit, modelRaw);
        if (pdf) {
          resolved = { hit, ...pdf };
          break;
        }
      }

      if (!resolved) {
        report.samples.push({
          model: modelRaw,
          url: candidates[0].url,
          domain: candidates[0].sourceDomain,
          official: candidates[0].official,
          verified: false,
        });
        continue;
      }

      report.verified += 1;
      const domain = resolved.hit.sourceDomain;
      report.domains[domain] = (report.domains[domain] ?? 0) + 1;
      if (resolved.hit.official) report.fromOfficial += 1;
      report.samples.push({
        model: modelRaw,
        url: resolved.url,
        domain,
        official: resolved.hit.official,
        verified: true,
        reason: resolved.reason,
      });

      await this.dataSource.query(
        `INSERT INTO manuals
           (brand_id, model, model_raw, url, source_domain, found_at_url,
            content_type, bytes, sha256, match_reason, verified, checked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true, now())
         ON CONFLICT (brand_id, model) DO UPDATE SET
           url = EXCLUDED.url, source_domain = EXCLUDED.source_domain,
           found_at_url = EXCLUDED.found_at_url,
           content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes,
           sha256 = EXCLUDED.sha256, match_reason = EXCLUDED.match_reason,
           verified = true, checked_at = now(), updated_at = now()`,
        [
          brandId,
          normalizeModel(modelRaw),
          modelRaw,
          resolved.url,
          domain,
          resolved.hit.direct ? null : resolved.hit.url,
          resolved.checked.contentType,
          resolved.checked.bytes,
          resolved.checked.sha256,
          resolved.reason,
        ],
      );
    }

    manufacturer.manualsFound = await this.manuals.count({
      where: { brandId },
    });
    await this.manufacturers.save(manufacturer);

    this.logger.log(
      `${report.brand}: busque ${report.tried} modelos, ${report.verified} manuales confirmados (${report.fromOfficial} de dominio oficial)`,
    );
    return report;
  }

  /**
   * Trae los manuales que encontro otro entorno.
   *
   * Es la contracara de tener dos bases contra la misma cuenta de Brave: lo que
   * ya se pago buscando en un lado no se vuelve a pagar en el otro. Las marcas
   * se resuelven por `slug`, porque los uuid son por base y no coinciden.
   */
  async importFrom(payload: ImportManualsDto): Promise<ImportReport> {
    const report: ImportReport = {
      recibidos: payload.manuals.length,
      guardados: 0,
      sinMarca: [],
      cupo: null,
    };

    for (const item of payload.manuals) {
      const slug = brandSlug(item.brand);
      const brand = await this.brands.findOne({ where: { slug } });
      if (!brand) {
        if (!report.sinMarca.includes(item.brand)) {
          report.sinMarca.push(item.brand);
        }
        continue;
      }

      await this.dataSource.query(
        `INSERT INTO manuals
           (brand_id, model, model_raw, url, source_domain, found_at_url,
            content_type, bytes, sha256, match_reason, verified, checked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true, now())
         ON CONFLICT (brand_id, model) DO UPDATE SET
           url = EXCLUDED.url, source_domain = EXCLUDED.source_domain,
           found_at_url = EXCLUDED.found_at_url,
           content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes,
           sha256 = EXCLUDED.sha256, match_reason = EXCLUDED.match_reason,
           verified = true, checked_at = now(), updated_at = now()`,
        [
          brand.id,
          normalizeModel(item.modelRaw),
          item.modelRaw,
          item.url,
          item.sourceDomain,
          item.foundAtUrl ?? null,
          item.contentType ?? null,
          item.bytes ?? null,
          item.sha256 ?? null,
          item.matchReason ?? null,
        ],
      );
      report.guardados += 1;
    }

    if (payload.searchQuotaUsed !== undefined) {
      report.cupo = await this.brave.raiseUsedTo(payload.searchQuotaUsed);
    }

    // Los contadores por marca quedan viejos despues de importar.
    await this.dataSource.query(
      `UPDATE manufacturers mf
       SET manuals_found = (SELECT count(*) FROM manuals m WHERE m.brand_id = mf.brand_id)`,
    );

    this.logger.log(
      `Importados ${report.guardados} de ${report.recibidos} manuales` +
        (report.sinMarca.length > 0
          ? `; sin marca en esta base: ${report.sinMarca.join(', ')}`
          : ''),
    );
    return report;
  }

  /** Modelos con codigo plausible que todavia no tienen manual. */
  private async modelsWithoutManual(
    brandId: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.dataSource.query<{ modelo: string }[]>(
      `SELECT DISTINCT (SELECT a->>'value_name' FROM jsonb_array_elements(p.attributes) a
                         WHERE a->>'id' = 'MODEL') AS modelo
       FROM products p
       WHERE p.brand_id = $1
       LIMIT 400`,
      [brandId],
    );

    const existing = new Set(
      (
        await this.manuals.find({ where: { brandId }, select: { model: true } })
      ).map((m) => m.model),
    );

    return rows
      .map((r) => r.modelo)
      .filter((m): m is string => typeof m === 'string' && isModelCode(m))
      .filter((m) => !existing.has(normalizeModel(m)))
      .slice(0, limit);
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

  /**
   * Los manuales con el producto al que corresponden.
   *
   * La tabla `manuals` se indexa por (marca, modelo) y no por producto porque
   * un mismo PDF cubre varios modelos de una linea. Para mostrarlos hay que
   * volver a atarlos: se busca el producto de la misma marca cuyo atributo
   * MODEL normalizado coincide, y se informa cuantos comparten ese modelo.
   */
  list(brandId?: string) {
    return this.dataSource.query<ManualRow[]>(
      `SELECT m.id AS id,
              b.name AS brand,
              m.model AS model,
              m.model_raw AS "modelRaw",
              m.url AS url,
              m.source_domain AS "sourceDomain",
              m.bytes AS bytes,
              m.match_reason AS "matchReason",
              m.verified AS verified,
              m.checked_at AS "checkedAt",
              prod.id AS "productId",
              prod.name AS "productName",
              coalesce(prod.total, 0)::int AS "productCount"
       FROM manuals m
       JOIN brands b ON b.id = m.brand_id
       LEFT JOIN LATERAL (
         SELECT p.id, p.name, count(*) OVER () AS total
         FROM products p
         WHERE p.brand_id = m.brand_id
           AND upper(regexp_replace(
                 (SELECT a->>'value_name'
                  FROM jsonb_array_elements(p.attributes) a
                  WHERE a->>'id' = 'MODEL'
                  LIMIT 1), '[^a-zA-Z0-9]', '', 'g')) = m.model
         ORDER BY p.last_seen_at DESC
         LIMIT 1
       ) prod ON true
       WHERE $1::uuid IS NULL OR m.brand_id = $1::uuid
       ORDER BY b.name ASC, m.model ASC`,
      [brandId ?? null],
    );
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

/**
 * Descarta lo que no parece un codigo de modelo.
 *
 * El atributo MODEL de ML trae de todo: numeros de repuesto (`2188656`),
 * medidas (`67 Litros`) y hasta rangos de temperatura (`+2/-7`). Buscar esos
 * gasta cupo y no devuelve nada, asi que se piden las dos cosas que tienen
 * todos los modelos reales: letras y digitos.
 */
function isModelCode(raw: string): boolean {
  const model = normalizeModel(raw);
  return (
    model.length >= 4 &&
    model.length <= 30 &&
    /[A-Z]/.test(model) &&
    /[0-9]/.test(model)
  );
}
