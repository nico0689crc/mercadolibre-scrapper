import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Manufacturer, type ManufacturerStatus } from '../database/entities';
import { BraveSearchService } from '../search/brave-search.service';
import {
  DomainResolverService,
  type DomainResolution,
} from '../search/domain-resolver.service';
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

/**
 * Digito verificador de EAN/UPC: desde la derecha, los digitos alternan peso
 * 3 y 1, y el total mas el verificador tiene que ser multiplo de 10.
 */
function isValidGtin(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;

  const body = digits.slice(0, -1).split('').reverse().map(Number);
  const check = Number(digits.at(-1));
  const sum = body.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Una marca del segmento con las señales que se evaluaron sobre ella. */
export interface SignalRow {
  brandId: string;
  brand: string;
  status: ManufacturerStatus | null;
  products: number;
  models: number;
  /** % de productos de la marca que declaran GTIN. */
  gtinPct: number;
  /** % de esos GTIN cuyo digito verificador es correcto. */
  gtinValidPct: number;
}

export interface Methodology {
  segment: string;
  label: string;
  domains: number;
  thresholds: { minProducts: number; minModels: number };
  funnel: { brandsInSegment: number; candidates: number };
  counts: { candidate: number; verified: number; rejected: number };
  signals: SignalRow[];
}

/** Un fabricante tal como lo devuelve la API: la fila mas el nombre de la marca. */
export interface ManufacturerRow {
  brandId: string;
  name: string;
  mlValueId: string | null;
  status: ManufacturerStatus;
  segment: string;
  officialDomains: string[];
  evidenceUrl: string | null;
  notes: string | null;
  products: number;
  models: number;
  verifiedAt: Date | null;
}

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
    private readonly resolver: DomainResolverService,
    private readonly brave: BraveSearchService,
  ) {}

  /** Cuanto cupo de busqueda queda este mes. */
  quotaUsage() {
    return this.brave.usage();
  }

  /**
   * Propone el dominio oficial de una marca. No lo guarda: devuelve la
   * propuesta con su evidencia para que alguien la acepte, porque `verified`
   * sigue exigiendo un manual descargado desde ahi.
   */
  async resolveDomain(
    brandId: string,
    useSearch = true,
  ): Promise<DomainResolution> {
    const m = await this.repo.findOne({
      where: { brandId },
      relations: { brand: true },
    });
    if (!m) {
      throw new NotFoundException(
        `La marca ${brandId} no esta en manufacturers`,
      );
    }
    return this.resolver.resolve(m.brand.name, useSearch);
  }

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
    const qb = this.rowsQuery();

    if (segment) qb.andWhere('m.segment = :segment', { segment });
    if (status) qb.andWhere('m.status = :status', { status });

    return qb.getRawMany<ManufacturerRow>();
  }

  /** Curacion manual: aceptar como fabricante con sus dominios oficiales. */
  async accept(brandId: string, officialDomains: string[], notes?: string) {
    const m = await this.get(brandId);
    m.status = 'verified';
    m.officialDomains = officialDomains;
    m.notes = notes ?? m.notes;
    m.verifiedAt = new Date();
    await this.repo.save(m);
    return this.row(brandId);
  }

  /** Curacion manual: descartar (vendedor de marketplace, marca propia, basura). */
  async reject(brandId: string, notes?: string) {
    const m = await this.get(brandId);
    m.status = 'rejected';
    m.notes = notes ?? m.notes;
    m.verifiedAt = null;
    await this.repo.save(m);
    return this.row(brandId);
  }

  /**
   * Las mutaciones devuelven la misma fila que `list()`, no la entidad cruda:
   * `manufacturers` no tiene `name` (el nombre vive en `brands`), asi que
   * devolver la entidad dejaba al frontend con un `name` undefined.
   */
  private async row(brandId: string): Promise<ManufacturerRow> {
    const row = await this.rowsQuery()
      .andWhere('m.brand_id = :brandId', { brandId })
      .getRawOne<ManufacturerRow>();

    if (!row) {
      throw new NotFoundException(
        `La marca ${brandId} no esta en manufacturers`,
      );
    }
    return row;
  }

  /** La proyeccion publica de un fabricante, con el nombre de la marca. */
  private rowsQuery() {
    return this.repo
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

  /**
   * Por que estas marcas son fabricantes: los numeros que sostienen el criterio,
   * calculados en vivo sobre la base. No hay constantes escritas a mano aca.
   */
  async methodology(segment: string): Promise<Methodology> {
    const domains = segmentDomains(segment);
    if (domains.length === 0) {
      throw new BadRequestException(`Segmento desconocido: ${segment}`);
    }

    const [all, passing, counts] = await Promise.all([
      this.candidates(segment, true),
      this.candidates(segment, false),
      this.counts(),
    ]);

    // Muestra de contraste: los curados en ambos sentidos y los candidatos mas
    // grandes. Es donde se ve que el GTIN no separa y los modelos si.
    const reference = [
      ...all.filter((c) => c.status === 'verified'),
      ...all.filter((c) => c.status === 'rejected'),
      ...passing
        .filter((c) => c.status !== 'verified' && c.status !== 'rejected')
        .slice(0, 6),
    ];

    const signals = await this.gtinSignals(domains, reference);

    return {
      segment,
      label: SEGMENTS[segment].label,
      domains: domains.length,
      thresholds: { minProducts: MIN_PRODUCTS, minModels: MIN_MODELS },
      funnel: { brandsInSegment: all.length, candidates: passing.length },
      counts: {
        candidate: counts.find((c) => c.status === 'candidate')?.total ?? 0,
        verified: counts.find((c) => c.status === 'verified')?.total ?? 0,
        rejected: counts.find((c) => c.status === 'rejected')?.total ?? 0,
      },
      signals,
    };
  }

  /**
   * Mide, por marca, cuantos productos declaran GTIN y cuantos de esos tienen
   * el digito verificador correcto. Es la señal que uno esperaria que separara
   * fabricante de revendedor y que en los datos no lo hace.
   */
  private async gtinSignals(
    domains: string[],
    reference: ManufacturerCandidate[],
  ): Promise<SignalRow[]> {
    if (reference.length === 0) return [];

    const rows = await this.dataSource.query<
      { brand_id: string; gtin: string | null }[]
    >(
      `
      SELECT p.brand_id,
             (SELECT a->>'value_name' FROM jsonb_array_elements(p.attributes) a
               WHERE a->>'id' = 'GTIN') AS gtin
      FROM products p
      WHERE p.domain_id = ANY($1::varchar[])
        AND p.brand_id = ANY($2::uuid[])
      `,
      [domains, reference.map((r) => r.brandId)],
    );

    const stats = new Map<
      string,
      { total: number; withGtin: number; valid: number }
    >();
    for (const row of rows) {
      const s = stats.get(row.brand_id) ?? { total: 0, withGtin: 0, valid: 0 };
      s.total += 1;
      if (row.gtin) {
        s.withGtin += 1;
        if (isValidGtin(row.gtin)) s.valid += 1;
      }
      stats.set(row.brand_id, s);
    }

    return reference.map((r) => {
      const s = stats.get(r.brandId) ?? { total: 0, withGtin: 0, valid: 0 };
      return {
        brandId: r.brandId,
        brand: r.name,
        status: r.status,
        products: r.products,
        models: r.models,
        gtinPct: s.total > 0 ? Math.round((100 * s.withGtin) / s.total) : 0,
        gtinValidPct:
          s.withGtin > 0 ? Math.round((100 * s.valid) / s.withGtin) : 0,
      };
    });
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
