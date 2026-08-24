import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Product } from '../database/entities';
import { MlApiService } from '../mercadolibre/ml-api.service';
import type {
  MlProduct,
  MlProductDetail,
  MlProductItems,
} from '../mercadolibre/categories/category.types';

export interface ProductQuery {
  categoryId?: string;
  brandId?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  domainId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  lastSeenAt: Date;
}

export interface ProductList {
  total: number;
  items: ProductListItem[];
}

/** Cuanto vale el detalle cacheado antes de volver a pedirlo a ML. */
const DETAIL_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ProductsStoreService {
  private readonly logger = new Logger(ProductsStoreService.name);

  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    private readonly ml: MlApiService,
  ) {}

  /**
   * Guarda los productos de un scan. `brandIdByKey` mapea el value_id de ML (o
   * el nombre, si ML no da value_id) al uuid de nuestra tabla de marcas.
   */
  async persist(
    products: MlProduct[],
    siteId: string,
    categoryId: string,
    brandIdByKey: Map<string, string>,
  ): Promise<number> {
    if (products.length === 0) return 0;

    const now = new Date();
    const rows = products.map((p) => {
      const brand = p.attributes?.find((a) => a.id === 'BRAND');
      const key = brand?.value_id ?? brand?.value_name ?? '';

      return {
        id: p.id,
        siteId,
        domainId: p.domain_id ?? null,
        categoryId,
        brandId: brandIdByKey.get(key) ?? null,
        name: (p.name ?? '').slice(0, 512),
        status: p.status ?? 'active',
        // Todo esto ya venia en la respuesta del search.
        thumbnail: p.pictures?.[0]?.url ?? null,
        shortDescription: p.short_description?.content ?? null,
        attributes: p.attributes ?? [],
        pictures: p.pictures ?? [],
        tags: p.tags ?? [],
        qualityType: p.quality_type ?? null,
        parentId: p.parent_id ?? null,
        childrenCount: p.children_ids?.length ?? 0,
        mlDateCreated: p.date_created ? new Date(p.date_created) : null,
        mlLastUpdated: p.last_updated ? new Date(p.last_updated) : null,
        firstSeenAt: now,
        lastSeenAt: now,
      };
    });

    // ON CONFLICT que actualiza solo estas columnas: `first_seen_at` queda con
    // el valor de la primera vez que vimos el producto.
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Product)
      .values(rows)
      .orUpdate(
        [
          'site_id',
          'domain_id',
          'category_id',
          'brand_id',
          'name',
          'status',
          'thumbnail',
          'short_description',
          'attributes',
          'pictures',
          'tags',
          'quality_type',
          'parent_id',
          'children_count',
          'ml_date_created',
          'ml_last_updated',
          'last_seen_at',
        ],
        ['id'],
      )
      .execute();

    return rows.length;
  }

  async find(query: ProductQuery): Promise<ProductList> {
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoin('p.brand', 'b')
      .leftJoin('p.category', 'c')
      .select([
        'p.id AS id',
        'p.name AS name',
        'p.domain_id AS "domainId"',
        'p.category_id AS "categoryId"',
        'c.name AS "categoryName"',
        'p.brand_id AS "brandId"',
        'b.name AS "brandName"',
        'p.last_seen_at AS "lastSeenAt"',
      ])
      .orderBy('p.name', 'ASC')
      .limit(query.limit)
      .offset(query.offset);

    const count = this.repo.createQueryBuilder('p');

    if (query.categoryId) {
      qb.andWhere('p.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
      count.andWhere('p.category_id = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.brandId) {
      qb.andWhere('p.brand_id = :brandId', { brandId: query.brandId });
      count.andWhere('p.brand_id = :brandId', { brandId: query.brandId });
    }
    if (query.search) {
      qb.andWhere('p.name ILIKE :search', { search: `%${query.search}%` });
      count.andWhere('p.name ILIKE :search', { search: `%${query.search}%` });
    }

    const [items, total] = await Promise.all([
      qb.getRawMany<ProductListItem>(),
      count.getCount(),
    ]);

    return { total, items };
  }

  /**
   * Producto completo. El detalle caro (permalink, main_features, precios) se
   * pide a ML solo la primera vez o cuando el cache vencio: son 2 requests que
   * no tiene sentido pagar durante un scan masivo.
   */
  async findOne(id: string, refresh = false): Promise<Product> {
    const product = await this.repo.findOne({
      where: { id },
      relations: { brand: true, category: true },
    });

    if (!product) {
      throw new NotFoundException(
        `El producto ${id} no esta en la base. Corre un scan de su categoria primero.`,
      );
    }

    const stale =
      !product.detailFetchedAt ||
      Date.now() - product.detailFetchedAt.getTime() > DETAIL_TTL_MS;

    if (refresh || stale) {
      await this.enrich(product);
    }

    return product;
  }

  /** Trae de ML lo que el search no da y lo guarda en el producto. */
  private async enrich(product: Product): Promise<void> {
    const [detail, items] = await Promise.all([
      this.ml.get<MlProductDetail>(`/products/${product.id}`).catch(() => null),
      // 404 "No winners found" = el producto no tiene publicaciones activas.
      this.ml
        .get<MlProductItems>(`/products/${product.id}/items`)
        .catch(() => null),
    ]);

    if (detail) {
      product.permalink = detail.permalink || null;
      product.mainFeatures = (detail.main_features ?? []).map((f) => f.text);
    }

    const listings = items?.results ?? [];
    const prices = listings
      .map((i) => i.price)
      .filter((p) => typeof p === 'number');

    product.listingsCount = items
      ? (items.paging?.total ?? listings.length)
      : 0;
    product.sellersCount = new Set(listings.map((i) => i.seller_id)).size;
    product.priceMin = prices.length ? String(Math.min(...prices)) : null;
    product.priceMax = prices.length ? String(Math.max(...prices)) : null;
    product.currencyId = listings[0]?.currency_id ?? null;
    product.detailFetchedAt = new Date();

    await this.repo.save(product);
    this.logger.log(
      `Detalle de ${product.id}: ${product.listingsCount} publicaciones, ${prices.length} precios`,
    );
  }

  count(): Promise<number> {
    return this.repo.count();
  }
}
