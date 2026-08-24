import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { Category } from '../database/entities';
import { CategoriesService } from '../mercadolibre/categories/categories.service';
import type { MlCategorySummary } from '../mercadolibre/categories/category.types';

/** Detalles de categoria resueltos en paralelo contra ML. */
const DETAIL_CONCURRENCY = 6;

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
