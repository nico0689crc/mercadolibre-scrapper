import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MlApiService } from '../ml-api.service';
import type {
  BrandStrategy,
  CategoryBrand,
  CategoryBrands,
  CategoryScan,
  CategoryDetail,
  CategoryNode,
  MlAttribute,
  MlCategory,
  MlCategorySummary,
  MlHighlights,
  MlProduct,
  MlProductSearch,
  MlSite,
  MlTrend,
} from './category.types';

/** Cuantos productos destacados mira como maximo al inferir marcas. */
const HIGHLIGHTS_SAMPLE = 15;
/** Cuantas categorias resuelve en paralelo al armar un arbol. */
const TREE_CONCURRENCY = 6;
/** Productos por pagina en /products/search (maximo que acepta ML). */
const SEARCH_PAGE_SIZE = 50;
/** ML corta el paginado de /products/search pasado este offset. */
const SEARCH_MAX_OFFSET = 1000;
/**
 * Semillas de busqueda que corren en paralelo (cada una pagina en serie).
 * Por encima de la cantidad de semillas no aporta nada. Configurable porque es
 * la palanca principal del ritmo, junto con la pausa entre categorias.
 */
const DEFAULT_SEARCH_CONCURRENCY = 6;

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);
  private readonly siteId: string;
  // El arbol de categorias cambia muy poco: cachearlo evita miles de requests.
  private readonly cache = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();
  private readonly ttlMs = 60 * 60 * 1000;

  private readonly searchConcurrency: number;

  constructor(
    private readonly ml: MlApiService,
    config: ConfigService,
  ) {
    this.siteId = config.get<string>('mercadolibre.siteId')!;
    this.searchConcurrency = config.get<number>(
      'mercadolibre.searchConcurrency',
      DEFAULT_SEARCH_CONCURRENCY,
    );
  }

  getSites(): Promise<MlSite[]> {
    return this.cached('sites', () => this.ml.get<MlSite[]>('/sites'));
  }

  getRootCategories(siteId?: string): Promise<MlCategorySummary[]> {
    const site = siteId ?? this.siteId;
    return this.cached(`roots:${site}`, () =>
      this.ml.get<MlCategorySummary[]>(`/sites/${site}/categories`),
    );
  }

  async getCategory(id: string): Promise<CategoryDetail> {
    const raw = await this.rawCategory(id);
    return {
      id: raw.id,
      name: raw.name,
      totalItems: raw.total_items_in_this_category,
      isLeaf: (raw.children_categories ?? []).length === 0,
      catalogDomain:
        (raw.settings?.catalog_domain as string | undefined) ?? null,
      path: raw.path_from_root ?? [],
      children: raw.children_categories ?? [],
      permalink: raw.permalink,
    };
  }

  getAttributes(id: string): Promise<MlAttribute[]> {
    return this.cached(`attrs:${id}`, () =>
      this.ml.get<MlAttribute[]>(`/categories/${id}/attributes`),
    );
  }

  /**
   * Arbol descendente desde `id` (o desde las raices del sitio si no se pasa),
   * hasta `depth` niveles. depth=1 son solo los hijos directos.
   */
  async getTree(
    id: string | undefined,
    depth: number,
  ): Promise<CategoryNode[]> {
    const roots: MlCategorySummary[] = id
      ? [await this.rawCategory(id)]
      : await this.getRootCategories();

    return this.expand(roots, depth);
  }

  private async expand(
    nodes: MlCategorySummary[],
    depth: number,
  ): Promise<CategoryNode[]> {
    const resolved = await this.mapWithLimit(nodes, TREE_CONCURRENCY, (n) =>
      this.rawCategory(n.id),
    );

    return Promise.all(
      resolved.map(async (raw): Promise<CategoryNode> => {
        const children = raw.children_categories ?? [];
        return {
          id: raw.id,
          name: raw.name,
          totalItems: raw.total_items_in_this_category,
          children:
            depth > 1 && children.length > 0
              ? await this.expand(children, depth - 1)
              : children.map((c) => ({
                  id: c.id,
                  name: c.name,
                  totalItems: c.total_items_in_this_category ?? 0,
                  children: [],
                })),
        };
      }),
    );
  }

  /**
   * Marcas presentes en una categoria.
   *
   * ML no expone una lista cerrada de marcas: el atributo BRAND es texto libre
   * (`values: []`) y el search abierto de items devuelve 403. Las dos fuentes
   * que si responden con token de aplicacion:
   *
   * - `highlights`: los 15 productos de catalogo mas vendidos de la categoria.
   *   Una llamada, pero solo ve las marcas lideres.
   * - `catalog`: recorre /products/search acotado al dominio de la categoria,
   *   usando las busquedas mas populares (/trends) como semillas. Mucha mas
   *   cobertura; en Celulares levanta ~108 marcas contra las 3 de highlights.
   *
   * En ninguno de los dos casos el resultado es el universo de marcas: es una
   * muestra, y el response lo declara en `sampled` y `keywords`.
   */
  /** Version liviana: solo el agregado de marcas, sin los productos crudos. */
  async getBrands(
    categoryId: string,
    strategy: BrandStrategy = 'catalog',
    seeds = 5,
    pages = 4,
  ): Promise<CategoryBrands> {
    const { products: _products, ...brands } = await this.scanCategory(
      categoryId,
      strategy,
      seeds,
      pages,
    );
    return brands;
  }

  /**
   * Igual que getBrands pero devuelve tambien los productos de catalogo que
   * se recorrieron. Los usa el modulo catalog para persistirlos: son los mismos
   * productos de los que sale la marca, asi que no cuesta ni un request extra.
   */
  async scanCategory(
    categoryId: string,
    strategy: BrandStrategy = 'catalog',
    seeds = 5,
    pages = 4,
  ): Promise<CategoryScan> {
    const raw = await this.rawCategory(categoryId);
    const domainId =
      (raw.settings?.catalog_domain as string | undefined) ?? null;

    const scan =
      strategy === 'highlights'
        ? {
            products: await this.productsFromHighlights(categoryId),
            keywords: [],
            domainFiltered: false,
          }
        : await this.productsFromCatalog(raw, domainId, seeds, pages);

    return {
      categoryId: raw.id,
      categoryName: raw.name,
      domainId,
      strategy,
      sampled: scan.products.length,
      keywords: scan.keywords,
      domainFiltered: scan.domainFiltered,
      brands: this.countBrands(scan.products),
      products: scan.products,
    };
  }

  /** Fuente rapida: los productos destacados de la categoria. */
  private async productsFromHighlights(
    categoryId: string,
  ): Promise<MlProduct[]> {
    const highlights = await this.ml
      .get<MlHighlights>(`/highlights/${this.siteId}/category/${categoryId}`)
      .catch((): MlHighlights => ({ content: [] }));

    // Los ids MLAU* son publicaciones de usuario, no productos de catalogo:
    // /products/{id} devuelve un 404 en HTML para esos.
    const ids = (highlights.content ?? [])
      .filter((e) => e.type === 'PRODUCT' && /^[A-Z]{3}\d/.test(e.id))
      .slice(0, HIGHLIGHTS_SAMPLE)
      .map((e) => e.id);

    const products = await this.mapWithLimit(ids, TREE_CONCURRENCY, (id) =>
      this.ml.get<MlProduct>(`/products/${id}`).catch(() => null),
    );

    return products.filter((p): p is MlProduct => p !== null);
  }

  /**
   * Fuente amplia: barre el catalogo del dominio con varias semillas de busqueda.
   *
   * /products/search exige keywords y corta el paginado en offset 1000, asi que
   * la cobertura sale de combinar consultas, no de paginar una sola. Las semillas
   * mezclan terminos genericos (el nombre de la categoria y el de su padre, que
   * traen un mix amplio de marcas) con las busquedas de /trends, que estan
   * sesgadas a las marcas lideres pero llegan a productos que los genericos no
   * alcanzan.
   */
  private async productsFromCatalog(
    category: MlCategory,
    domainId: string | null,
    seeds: number,
    pages: number,
  ): Promise<{
    products: MlProduct[];
    keywords: string[];
    domainFiltered: boolean;
  }> {
    const trends = await this.ml
      .get<MlTrend[]>(`/trends/${this.siteId}/${category.id}`)
      .catch((): MlTrend[] => []);

    const parent = category.path_from_root?.at(-2)?.name;
    const keywords = [
      ...new Set(
        [category.name, parent, ...trends.map((t) => t.keyword)].filter(
          (k): k is string => Boolean(k),
        ),
      ),
    ].slice(0, seeds);

    // Las categorias raiz apuntan a un dominio generico (is_generic) que no tiene
    // productos de catalogo: filtrar por el devuelve cero. Se detecta con una
    // sonda barata y se cae a la busqueda sin filtro de dominio.
    const effectiveDomain =
      domainId && (await this.domainHasCatalog(domainId, keywords[0]))
        ? domainId
        : null;

    const perKeyword = await this.mapWithLimit(
      keywords,
      this.searchConcurrency,
      (keyword) => this.scanKeyword(keyword, effectiveDomain, pages),
    );

    // Las semillas se solapan mucho entre si: deduplicar antes de contar marcas.
    const unique = new Map<string, MlProduct>();
    for (const product of perKeyword.flat()) {
      unique.set(product.id, product);
    }

    return {
      products: [...unique.values()],
      keywords,
      domainFiltered: effectiveDomain !== null,
    };
  }

  private async domainHasCatalog(
    domainId: string,
    keyword: string,
  ): Promise<boolean> {
    const params = new URLSearchParams({
      site_id: this.siteId,
      status: 'active',
      q: keyword,
      domain_id: domainId,
      limit: '1',
    });

    const probe = await this.ml
      .get<MlProductSearch>(`/products/search?${params.toString()}`)
      .catch(() => null);

    return (probe?.paging?.total ?? 0) > 0;
  }

  /** Pagina una semilla hasta agotarla, el tope de ML o el limite pedido. */
  private async scanKeyword(
    keyword: string,
    domainId: string | null,
    pages: number,
  ): Promise<MlProduct[]> {
    const collected: MlProduct[] = [];

    for (let page = 0; page < pages; page++) {
      const offset = page * SEARCH_PAGE_SIZE;
      if (offset > SEARCH_MAX_OFFSET) break;

      const params = new URLSearchParams({
        site_id: this.siteId,
        status: 'active',
        q: keyword,
        limit: String(SEARCH_PAGE_SIZE),
        offset: String(offset),
      });
      if (domainId) params.set('domain_id', domainId);

      const batch = await this.ml
        .get<MlProductSearch>(`/products/search?${params.toString()}`)
        .then((r) => r.results ?? [])
        .catch(() => [] as MlProduct[]);

      if (batch.length === 0) break;
      collected.push(...batch);
    }

    return collected;
  }

  private countBrands(products: MlProduct[]): CategoryBrand[] {
    const counter = new Map<string, CategoryBrand>();

    for (const product of products) {
      const brand = product.attributes?.find((a) => a.id === 'BRAND');
      if (!brand?.value_name) continue;

      const key = brand.value_id ?? brand.value_name;
      const entry = counter.get(key);
      if (entry) {
        entry.products += 1;
      } else {
        counter.set(key, {
          id: brand.value_id ?? null,
          name: brand.value_name,
          products: 1,
        });
      }
    }

    return [...counter.values()].sort(
      (a, b) => b.products - a.products || a.name.localeCompare(b.name),
    );
  }

  private rawCategory(id: string): Promise<MlCategory> {
    return this.cached(`cat:${id}`, () =>
      this.ml.get<MlCategory>(`/categories/${id}`),
    );
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() < hit.expiresAt) {
      return hit.value as T;
    }
    const value = await load();
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  /** Corre `fn` sobre `items` con concurrencia acotada para no gatillar el 429. */
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
