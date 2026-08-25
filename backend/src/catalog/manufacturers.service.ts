import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Manufacturer, type ManufacturerStatus } from '../database/entities';
import { SEGMENTS, segmentDomains } from './segments';

/**
 * Umbrales del filtro automatico.
 *
 * Ninguna señal interna de ML separa fabricante de vendedor por si sola:
 * medimos que el GTIN valida igual de bien en VentDepot (99%) que en Samsung
 * (89%), porque los revendedores usan los GTIN reales de lo que revenden.
 * Lo que si discrimina es la cantidad de modelos DENTRO de un segmento: un
 * revendedor no acumula veinte codigos de modelo de heladeras.
 */
const MIN_PRODUCTS = 5;
const MIN_MODELS = 3;

export interface ManufacturerCandidate {
  brandId: string;
  name: string;
  mlValueId: string | null;
  products: number;
  models: number;
  status: ManufacturerStatus | null;
}

@Injectable()
export class ManufacturersService {
  private readonly logger = new Logger(ManufacturersService.name);

  constructor(
    @InjectRepository(Manufacturer)
    private readonly repo: Repository<Manufacturer>,
    private readonly dataSource: DataSource,
  ) {}

  segments() {
    return Object.entries(SEGMENTS).map(([key, s]) => ({
      key,
      label: s.label,
      domains: s.domains.length,
    }));
  }

  /**
   * Marcas del segmento que superan el umbral, con el estado que ya tengan.
   * No escribe nada: es la vista previa de lo que `detect` promoveria.
   */
  async candidates(
    segment: string,
    includeAll = false,
  ): Promise<ManufacturerCandidate[]> {
    const domains = segmentDomains(segment);
    if (domains.length === 0) {
      throw new BadRequestException(`Segmento desconocido: ${segment}`);
    }

    return this.dataSource.query<ManufacturerCandidate[]>(
      `
      WITH seg AS (
        SELECT b.id AS brand_id, b.name, b.ml_value_id, p.id AS product_id,
               (SELECT a->>'value_name' FROM jsonb_array_elements(p.attributes) a
                 WHERE a->>'id' = 'MODEL') AS modelo
        FROM products p
        JOIN brands b ON b.id = p.brand_id
        WHERE p.domain_id = ANY($1::varchar[])
      ), agg AS (
        SELECT brand_id, name, ml_value_id,
               count(DISTINCT product_id)::int AS products,
               count(DISTINCT modelo) FILTER (WHERE modelo IS NOT NULL)::int AS models
        FROM seg GROUP BY 1, 2, 3
      )
      SELECT a.brand_id AS "brandId", a.name, a.ml_value_id AS "mlValueId",
             a.products, a.models, m.status
      FROM agg a
      LEFT JOIN manufacturers m ON m.brand_id = a.brand_id
      WHERE $4::boolean OR (a.products >= $2 AND a.models >= $3)
      ORDER BY a.models DESC, a.products DESC
      `,
      [domains, MIN_PRODUCTS, MIN_MODELS, includeAll],
    );
  }

  /**
   * Congela los candidatos actuales como filas `candidate`. Idempotente: no
   * pisa el estado de los que ya fueron curados a mano.
   */
  async detect(
    segment: string,
  ): Promise<{ segment: string; detected: number; nuevos: number }> {
    const found = await this.candidates(segment);
    let nuevos = 0;

    for (const c of found) {
      const existing = await this.repo.findOne({
        where: { brandId: c.brandId },
      });
      if (existing) {
        existing.products = c.products;
        existing.models = c.models;
        await this.repo.save(existing);
        continue;
      }
      nuevos += 1;
      await this.repo.save(
        this.repo.create({
          brandId: c.brandId,
          segment,
          status: 'candidate',
          products: c.products,
          models: c.models,
        }),
      );
    }

    this.logger.log(
      `${segment}: ${found.length} candidatos (${nuevos} nuevos)`,
    );
    return { segment, detected: found.length, nuevos };
  }

  async list(segment?: string, status?: ManufacturerStatus) {
    const qb = this.repo
      .createQueryBuilder('m')
      .innerJoin('m.brand', 'b')
      .select([
        'm.brand_id AS "brandId"',
        'b.name AS name',
        'b.ml_value_id AS "mlValueId"',
        'm.status AS status',
        'm.segment AS segment',
        'm.official_domains AS "officialDomains"',
        'm.evidence_url AS "evidenceUrl"',
        'm.notes AS notes',
        'm.products AS products',
        'm.models AS models',
        'm.verified_at AS "verifiedAt"',
      ])
      .orderBy('m.models', 'DESC');

    if (segment) qb.andWhere('m.segment = :segment', { segment });
    if (status) qb.andWhere('m.status = :status', { status });

    return qb.getRawMany();
  }

  /** Curacion manual: aceptar como fabricante con sus dominios oficiales. */
  async accept(brandId: string, officialDomains: string[], notes?: string) {
    const m = await this.get(brandId);
    m.status = 'verified';
    m.officialDomains = officialDomains;
    m.notes = notes ?? m.notes;
    m.verifiedAt = new Date();
    return this.repo.save(m);
  }

  /** Curacion manual: descartar (vendedor de marketplace, marca propia, basura). */
  async reject(brandId: string, notes?: string) {
    const m = await this.get(brandId);
    m.status = 'rejected';
    m.notes = notes ?? m.notes;
    m.verifiedAt = null;
    return this.repo.save(m);
  }

  private async get(brandId: string): Promise<Manufacturer> {
    const m = await this.repo.findOne({ where: { brandId } });
    if (!m) {
      throw new NotFoundException(
        `La marca ${brandId} no esta en manufacturers. Corre POST /api/catalog/manufacturers/detect primero.`,
      );
    }
    return m;
  }

  counts() {
    return this.repo
      .createQueryBuilder('m')
      .select('m.status', 'status')
      .addSelect('count(*)::int', 'total')
      .groupBy('m.status')
      .getRawMany<{ status: ManufacturerStatus; total: number }>();
  }
}
