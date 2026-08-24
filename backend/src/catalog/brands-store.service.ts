import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Brand, CategoryBrand } from '../database/entities';
import type { CategoryBrands } from '../mercadolibre/categories/category.types';

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
    const brandIdByKey = new Map<string, string>();
    let brandsNew = 0;

    await this.dataSource.transaction(async (manager) => {
      const brandRepo = manager.getRepository(Brand);
      const linkRepo = manager.getRepository(CategoryBrand);

      for (const found of scan.brands) {
        const slug = brandSlug(found.name);
        if (!slug) continue;

        // La identidad es el value_id de ML si existe; si no, el nombre normalizado.
        let brand = found.id
          ? await brandRepo.findOne({ where: { mlValueId: found.id } })
          : null;
        brand ??= await brandRepo.findOne({ where: { slug } });

        if (!brand) {
          brand = brandRepo.create({
            mlValueId: found.id,
            name: found.name,
            slug,
          });
          brand = await brandRepo.save(brand);
        } else if (found.id && !brand.mlValueId) {
          // Una marca vista antes sin value_id ahora si lo tiene: enriquecerla.
          brand.mlValueId = found.id;
          brand = await brandRepo.save(brand);
        }

        // El scan identifica la marca por value_id si lo hay, si no por nombre.
        brandIdByKey.set(found.id ?? found.name, brand.id);

        const existing = await linkRepo.findOne({
          where: { categoryId: scan.categoryId, brandId: brand.id },
        });

        if (existing) {
          existing.products = found.products;
          existing.productsMax = Math.max(existing.productsMax, found.products);
          existing.occurrences += 1;
          existing.lastSeenAt = now;
          await linkRepo.save(existing);
        } else {
          brandsNew += 1;
          await linkRepo.save(
            linkRepo.create({
              categoryId: scan.categoryId,
              brandId: brand.id,
              products: found.products,
              productsMax: found.products,
              occurrences: 1,
              firstSeenAt: now,
              lastSeenAt: now,
            }),
          );
        }
      }
    });

    this.logger.log(
      `${scan.categoryId}: ${scan.brands.length} marcas (${brandsNew} nuevas)`,
    );
    return { brandsFound: scan.brands.length, brandsNew, brandIdByKey };
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
  async findAll(limit: number, offset: number, search?: string) {
    const qb = this.brands
      .createQueryBuilder('b')
      .leftJoin(CategoryBrand, 'cb', 'cb.brand_id = b.id')
      .select('b.id', 'id')
      .addSelect('b.ml_value_id', 'mlValueId')
      .addSelect('b.name', 'name')
      .addSelect('COUNT(DISTINCT cb.category_id)', 'categories')
      .addSelect('COALESCE(SUM(cb.products_max), 0)', 'products')
      .groupBy('b.id')
      .orderBy('products', 'DESC')
      .limit(limit)
      .offset(offset);

    if (search) {
      qb.where('b.name ILIKE :search', { search: `%${search}%` });
    }

    const [rows, total] = await Promise.all([
      qb.getRawMany<{
        id: string;
        mlValueId: string | null;
        name: string;
        categories: string;
        products: string;
      }>(),
      this.countBrands(search),
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
