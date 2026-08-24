import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type SelectQueryBuilder } from 'typeorm';

import { Category } from '../database/entities';
import { CategoriesService } from '../mercadolibre/categories/categories.service';
import type { MlCategorySummary } from '../mercadolibre/categories/category.types';
import type {
  CategorySort,
  ListCategoriesDto,
} from './dto/list-categories.dto';

/** Detalles de categoria resueltos en paralelo contra ML. */
const DETAIL_CONCURRENCY = 6;

/** Categoria con lo que ya juntamos de ella, para la tabla del listado. */
export interface CategoryListItem extends Category {
  /** `brands` y `products` ya son relaciones en la entidad: van con sufijo. */
  brandsCount: number;
  productsCount: number;
}

export interface CategoryList {
  total: number;
  items: CategoryListItem[];
}

/** Nodo minimo del arbol: lo que necesita la cascada de selects del frontend. */
export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  isLeaf: boolean;
}

/** Expresion por la que ordena cada columna de la tabla de categorias. */
const CATEGORY_ORDER: Record<CategorySort, string> = {
  name: 'c.name',
  items: 'c.total_items',
  depth: 'c.depth',
  brands: 'brands_count',
  products: 'products_count',
};

const BRANDS_OF_CATEGORY =
  'SELECT COUNT(*) FROM category_brands cb WHERE cb.category_id = c.id';
const PRODUCTS_OF_CATEGORY =
  'SELECT COUNT(*) FROM products p WHERE p.category_id = c.id';
// Ojo: con COUNT(*) el EXISTS da siempre true (la agregacion devuelve una fila).
const HAS_BRANDS =
  'EXISTS (SELECT 1 FROM category_brands cb WHERE cb.category_id = c.id)';

export interface SyncResult {
  siteId: string;
  depth: number;
  categoriesUpserted: number;
  durationMs: number;
}

/** Espeja el arbol de categorias de ML en la base y lo sirve desde ahi. */
@Injectable()
export class CategoriesStoreService {
  private readonly logger = new Logger(CategoriesStoreService.name);
  private readonly siteId: string;

  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    private readonly ml: CategoriesService,
    config: ConfigService,
  ) {
    this.siteId = config.get<string>('mercadolibre.siteId')!;
  }

  /**
   * Trae el arbol desde ML y lo persiste. `depth` 1 son las raices, 2 agrega el
   * segundo nivel (457 categorias en MLA), 3 el tercero.
   */
  async sync(depth: number, siteId?: string): Promise<SyncResult> {
    const site = siteId ?? this.siteId;
    const startedAt = Date.now();

    const roots = await this.ml.getRootCategories(site);
    let upserted = await this.upsertLevel(roots, site, 0, null, []);

    if (depth > 1) {
      upserted += await this.syncChildren(roots, site, 1, depth);
    }

    const result: SyncResult = {
      siteId: site,
      depth,
      categoriesUpserted: upserted,
      durationMs: Date.now() - startedAt,
    };
    this.logger.log(
      `Sync ${site} depth=${depth}: ${upserted} categorias en ${result.durationMs}ms`,
    );
    return result;
  }

  private async syncChildren(
    parents: MlCategorySummary[],
    site: string,
    level: number,
    maxDepth: number,
  ): Promise<number> {
    let total = 0;

    for (const parent of parents) {
      const detail = await this.ml.getCategory(parent.id).catch(() => null);
      if (!detail?.children.length) continue;

      total += await this.upsertLevel(
        detail.children,
        site,
        level,
        parent.id,
        detail.path,
      );

      if (level + 1 < maxDepth) {
        total += await this.syncChildren(
          detail.children,
          site,
          level + 1,
          maxDepth,
        );
      }
    }

    return total;
  }

  private async upsertLevel(
    categories: MlCategorySummary[],
    site: string,
    depth: number,
    parentId: string | null,
    parentPath: { id: string; name: string }[],
  ): Promise<number> {
    if (categories.length === 0) return 0;

    // El detalle (catalog_domain, is_leaf) solo viene en /categories/{id}:
    // una llamada por categoria, con concurrencia acotada para no gatillar el 429.
    const rows = await this.mapWithLimit(
      categories,
      DETAIL_CONCURRENCY,
      async (c) => {
        const detail = await this.ml.getCategory(c.id).catch(() => null);
        return {
          id: c.id,
          siteId: site,
          name: c.name,
          parentId,
          totalItems: detail?.totalItems ?? c.total_items_in_this_category ?? 0,
          catalogDomain: detail?.catalogDomain ?? null,
          isLeaf: detail?.isLeaf ?? false,
          depth,
          path: detail?.path ?? [...parentPath, { id: c.id, name: c.name }],
          syncedAt: new Date(),
        };
      },
    );

    await this.repo.upsert(rows, {
      conflictPaths: ['id'],
      skipUpdateIfNoValuesChanged: true,
    });

    return rows.length;
  }

  /**
   * Listado filtrable del arbol. Cada fila trae ademas cuantas marcas y cuantos
   * productos le conocemos, que es lo que dice si vale la pena escanearla.
   */
  async find(query: ListCategoriesDto): Promise<CategoryList> {
    const rows = this.repo
      .createQueryBuilder('c')
      .addSelect(`(${BRANDS_OF_CATEGORY})`, 'brands_count')
      .addSelect(`(${PRODUCTS_OF_CATEGORY})`, 'products_count')
      .orderBy(CATEGORY_ORDER[query.sort], query.dir === 'asc' ? 'ASC' : 'DESC')
      // Desempate estable para que el paginado no repita filas.
      .addOrderBy('c.name', 'ASC')
      .limit(query.limit)
      .offset(query.offset);

    const count = this.repo.createQueryBuilder('c');

    this.applyFilters(rows, query);
    this.applyFilters(count, query);

    const [result, total] = await Promise.all([
      rows.getRawAndEntities<{
        brands_count: string;
        products_count: string;
      }>(),
      count.getCount(),
    ]);

    return {
      total,
      items: result.entities.map((category, index) => ({
        ...category,
        brandsCount: Number(result.raw[index]?.brands_count ?? 0),
        productsCount: Number(result.raw[index]?.products_count ?? 0),
      })),
    };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Category>,
    query: ListCategoriesDto,
  ): void {
    if (query.parent) {
      qb.andWhere('c.parent_id = :parent', { parent: query.parent });
    } else if (query.branch) {
      // `path` es el path_from_root de ML y se incluye a si misma, asi que
      // esto matchea la categoria y toda su descendencia.
      qb.andWhere('c.path @> :branch::jsonb', {
        branch: JSON.stringify([{ id: query.branch }]),
      });
    } else if (query.scope === 'roots') {
      qb.andWhere('c.parent_id IS NULL');
    }

    if (query.search) {
      qb.andWhere('(c.name ILIKE :search OR c.id ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.depth !== undefined) {
      qb.andWhere('c.depth = :depth', { depth: query.depth });
    }
    if (query.leaf !== 'any') {
      qb.andWhere('c.is_leaf = :leaf', { leaf: query.leaf === 'yes' });
    }
    if (query.domain !== 'any') {
      qb.andWhere(
        query.domain === 'yes'
          ? 'c.catalog_domain IS NOT NULL'
          : 'c.catalog_domain IS NULL',
      );
    }
    if (query.brands !== 'any') {
      qb.andWhere(query.brands === 'yes' ? HAS_BRANDS : `NOT ${HAS_BRANDS}`);
    }
    if (query.minItems !== undefined) {
      qb.andWhere('c.total_items >= :minItems', { minItems: query.minItems });
    }
  }

  /**
   * El arbol entero, sin contadores ni path: son ~500 filas de pocos bytes que
   * el frontend usa para armar la cascada categoria -> subcategoria sin volver
   * a pedir nada en cada paso.
   */
  async tree(): Promise<CategoryNode[]> {
    return this.repo
      .createQueryBuilder('c')
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .addSelect('c.parent_id', 'parentId')
      .addSelect('c.depth', 'depth')
      .addSelect('c.is_leaf', 'isLeaf')
      .orderBy('c.depth', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .getRawMany<CategoryNode>();
  }

  /** Categorias de un nivel. Sin `parentId` devuelve las raices. */
  findChildren(parentId?: string): Promise<Category[]> {
    return this.repo.find({
      where: { parentId: parentId ? parentId : IsNull() },
      order: { totalItems: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(
        `La categoria ${id} no esta en la base. Corre POST /api/catalog/sync primero.`,
      );
    }
    return category;
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  /** Corre `fn` sobre `items` con concurrencia acotada, preservando el orden. */
  private async mapWithLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array<R>(items.length);
    let cursor = 0;

    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (cursor < items.length) {
          const index = cursor++;
          results[index] = await fn(items[index]);
        }
      },
    );

    await Promise.all(workers);
    return results;
  }
}
