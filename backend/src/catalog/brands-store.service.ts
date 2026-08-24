import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, type SelectQueryBuilder } from 'typeorm';

import { Brand, CategoryBrand } from '../database/entities';
import type { CategoryBrands } from '../mercadolibre/categories/category.types';
import type { BrandSort } from './dto/list-brands.dto';

export interface StoredBrand {
  id: string;
  mlValueId: string | null;
  name: string;
  products: number;
  productsMax: number;
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface BrandQuery {
  limit: number;
  offset: number;
  search?: string;
  /** Marcas presentes en esta categoria o en su descendencia. */
  branch?: string;
  minProducts?: number;
  minCategories?: number;
  sort: BrandSort;
  dir: 'asc' | 'desc';
}

/** Expresion por la que ordena cada columna de la tabla de marcas. */
const BRAND_ORDER: Record<BrandSort, string> = {
  name: 'b.name',
  categories: 'categories',
  products: 'products',
};

/** Postgres no acepta el alias del SELECT en el HAVING: hay que repetirlo. */
const PRODUCTS_SUM = 'COALESCE(SUM(cb.products_max), 0)';
const CATEGORIES_COUNT = 'COUNT(DISTINCT cb.category_id)';

export interface PersistResult {
  brandsFound: number;
  brandsNew: number;
  /**
   * Mapa del identificador que trae ML (value_id, o el nombre si no hay value_id)
   * al uuid de nuestra tabla `brands`. Lo usa ProductsStoreService para enlazar
   * cada producto con su marca sin volver a consultar.
   */
  brandIdByKey: Map<string, string>;
}

/** Normaliza el nombre de marca para deduplicar cuando ML no da value_id. */
export function brandSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 255);
}

@Injectable()
export class BrandsStoreService {
  private readonly logger = new Logger(BrandsStoreService.name);

  constructor(
    @InjectRepository(Brand)
    private readonly brands: Repository<Brand>,
    @InjectRepository(CategoryBrand)
    private readonly links: Repository<CategoryBrand>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Guarda el resultado de un scan acumulando: `products` refleja la ultima
   * corrida, `productsMax` se queda con el maximo historico y `occurrences`
   * cuenta cuantos scans vieron la marca. Asi un scan chico no borra cobertura
   * que un scan grande ya habia conseguido.
   */
  async persistScan(scan: CategoryBrands): Promise<PersistResult> {
    if (scan.brands.length === 0) {
      return { brandsFound: 0, brandsNew: 0, brandIdByKey: new Map() };
    }

    const now = new Date();

    // Dos scans de la misma categoria pueden correr a la vez (varias pestañas, o
    // el crawler solapado con un scan manual). Por eso todo lo que sigue son
    // upserts atomicos: un check-then-insert perdia la carrera y reventaba con
    // "duplicate key value violates unique constraint".
    const brandIdBySlug = await this.upsertBrands(scan.brands);
    const brandIdByKey = new Map<string, string>();

    // Deduplicar por brand_id: dos nombres del scan pueden normalizar al mismo
    // slug, y un ON CONFLICT no puede tocar la misma fila dos veces.
    const links = new Map<string, { brandId: string; products: number }>();

    for (const found of scan.brands) {
      const slug = brandSlug(found.name);
      const brandId = slug ? brandIdBySlug.get(slug) : undefined;
      if (!brandId) continue;

      brandIdByKey.set(found.id ?? found.name, brandId);
      const prev = links.get(brandId);
      // Si dos entradas caen en la misma marca, nos quedamos con la mayor.
      if (!prev || found.products > prev.products) {
        links.set(brandId, { brandId, products: found.products });
      }
    }

    const brandsNew = await this.upsertCategoryBrands(
      scan.categoryId,
      [...links.values()],
      now,
    );

    this.logger.log(
      `${scan.categoryId}: ${links.size} marcas (${brandsNew} nuevas)`,
    );
    return { brandsFound: links.size, brandsNew, brandIdByKey };
  }

  /** Inserta o actualiza las marcas y devuelve el uuid de cada una, por slug. */
  private async upsertBrands(
    found: CategoryBrands['brands'],
  ): Promise<Map<string, string>> {
    // Un mismo slug puede venir varias veces en un scan ("Samsung" y "SAMSUNG").
    // Nos quedamos con la variante que trae value_id, que es la identidad fuerte.
    const bySlug = new Map<
      string,
      { slug: string; name: string; mlValueId: string | null }
    >();

    for (const brand of found) {
      const slug = brandSlug(brand.name);
      if (!slug) continue;
      const prev = bySlug.get(slug);
      if (!prev || (!prev.mlValueId && brand.id)) {
        bySlug.set(slug, { slug, name: brand.name, mlValueId: brand.id });
      }
    }

    const rows = [...bySlug.values()];
    if (rows.length === 0) return new Map();

    // El conflicto se resuelve por slug. `ml_value_id` NO se toca aca: tiene su
    // propio indice unico parcial y pisarlo desde el EXCLUDED podria violarlo.
    const values = rows
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
      .join(', ');
    const params = rows.flatMap((r) => [r.name, r.slug]);

    const upserted = await this.dataSource.query<
      { id: string; slug: string }[]
    >(
      `INSERT INTO brands (name, slug) VALUES ${values}
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
       RETURNING id, slug`,
      params,
    );

    const idBySlug = new Map(upserted.map((r) => [r.slug, r.id]));
    await this.enrichMlValueIds(rows);
    return idBySlug;
  }

  /**
   * Completa el value_id de ML en marcas que se habian visto sin el.
   * Best-effort y fuera de toda transaccion: si otra corrida ya reclamo ese
   * value_id, la marca simplemente se queda sin el hasta la proxima.
   */
  private async enrichMlValueIds(
    rows: { slug: string; mlValueId: string | null }[],
  ): Promise<void> {
    for (const row of rows) {
      if (!row.mlValueId) continue;
      try {
        await this.dataSource.query(
          `UPDATE brands SET ml_value_id = $1, updated_at = now()
           WHERE slug = $2 AND ml_value_id IS NULL
             AND NOT EXISTS (SELECT 1 FROM brands WHERE ml_value_id = $1)`,
          [row.mlValueId, row.slug],
        );
      } catch {
        // Carrera con otra corrida por el mismo value_id: no es fatal.
      }
    }
  }

  /**
   * Acumula la relacion marca-categoria. `products` refleja la ultima corrida,
   * `products_max` se queda con el maximo historico (asi un scan chico no borra
   * cobertura de uno grande) y `occurrences` cuenta cuantos scans la vieron.
   * Devuelve cuantas filas eran nuevas (xmax = 0 marca un INSERT real).
   */
  private async upsertCategoryBrands(
    categoryId: string,
    links: { brandId: string; products: number }[],
    now: Date,
  ): Promise<number> {
    if (links.length === 0) return 0;

    // Los casts van en el VALUES: Postgres no puede inferir el tipo de un
    // parametro suelto dentro de una tabla derivada.
    const values = links
      .map(
        (_, i) => `($${i * 2 + 2}::uuid, $${i * 2 + 3}::int, $1::timestamptz)`,
      )
      .join(', ');
    const params: unknown[] = [
      now,
      ...links.flatMap((l) => [l.brandId, l.products]),
    ];

    const rows = await this.dataSource.query<{ inserted: boolean }[]>(
      `INSERT INTO category_brands
         (brand_id, products, first_seen_at, last_seen_at, category_id, products_max, occurrences)
       SELECT v.brand_id, v.products, v.seen, v.seen, $${params.length + 1}, v.products, 1
       FROM (VALUES ${values}) AS v(brand_id, products, seen)
       ON CONFLICT (category_id, brand_id) DO UPDATE SET
         products = EXCLUDED.products,
         products_max = GREATEST(category_brands.products_max, EXCLUDED.products),
         occurrences = category_brands.occurrences + 1,
         last_seen_at = EXCLUDED.last_seen_at,
         updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [...params, categoryId],
    );

    return rows.filter((r) => r.inserted).length;
  }

  /** Marcas acumuladas de una categoria, de mayor a menor cobertura. */
  async findByCategory(categoryId: string): Promise<StoredBrand[]> {
    const rows = await this.links.find({
      where: { categoryId },
      relations: { brand: true },
      order: { productsMax: 'DESC' },
    });

    return rows.map((r) => ({
      id: r.brand.id,
      mlValueId: r.brand.mlValueId,
      name: r.brand.name,
      products: r.products,
      productsMax: r.productsMax,
      occurrences: r.occurrences,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
    }));
  }

  /** Marcas globales con en cuantas categorias aparece cada una. */
  async findAll(query: BrandQuery) {
    const base = this.brands
      .createQueryBuilder('b')
      .leftJoin(CategoryBrand, 'cb', 'cb.brand_id = b.id')
      .select('b.id', 'id')
      .addSelect('b.ml_value_id', 'mlValueId')
      .addSelect('b.name', 'name')
      .addSelect(CATEGORIES_COUNT, 'categories')
      .addSelect(PRODUCTS_SUM, 'products')
      .groupBy('b.id');

    this.applyFilters(base, query);

    const page = base
      .clone()
      .orderBy(BRAND_ORDER[query.sort], query.dir === 'asc' ? 'ASC' : 'DESC')
      // Desempate estable: sin esto dos marcas con el mismo total pueden
      // cambiar de pagina entre requests.
      .addOrderBy('b.name', 'ASC')
      .limit(query.limit)
      .offset(query.offset);

    const [rows, total] = await Promise.all([
      page.getRawMany<{
        id: string;
        mlValueId: string | null;
        name: string;
        categories: string;
        products: string;
      }>(),
      // Con GROUP BY + HAVING el total son las filas agrupadas, no las marcas:
      // hay que contar sobre la consulta ya agrupada.
      this.countGrouped(base),
    ]);

    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        mlValueId: r.mlValueId,
        name: r.name,
        categories: Number(r.categories),
        products: Number(r.products),
      })),
    };
  }

  private applyFilters(qb: SelectQueryBuilder<Brand>, query: BrandQuery): void {
    if (query.search) {
      qb.andWhere('b.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.branch) {
      qb.andWhere(
        `EXISTS (
           SELECT 1 FROM category_brands link
           JOIN categories cat ON cat.id = link.category_id
           WHERE link.brand_id = b.id AND cat.path @> :branch::jsonb
         )`,
        { branch: JSON.stringify([{ id: query.branch }]) },
      );
    }
    if (query.minProducts !== undefined) {
      qb.andHaving(`${PRODUCTS_SUM} >= :minProducts`, {
        minProducts: query.minProducts,
      });
    }
    if (query.minCategories !== undefined) {
      qb.andHaving(`${CATEGORIES_COUNT} >= :minCategories`, {
        minCategories: query.minCategories,
      });
    }
  }

  /** Cuenta las filas que devuelve una consulta ya agrupada. */
  private async countGrouped(base: SelectQueryBuilder<Brand>): Promise<number> {
    const row = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'total')
      .from(`(${base.getQuery()})`, 'grouped')
      .setParameters(base.getParameters())
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  countBrands(search?: string): Promise<number> {
    if (!search) return this.brands.count();
    return this.brands
      .createQueryBuilder('b')
      .where('b.name ILIKE :search', { search: `%${search}%` })
      .getCount();
  }

  countLinks(): Promise<number> {
    return this.links.count();
  }
}
