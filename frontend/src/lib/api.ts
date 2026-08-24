import type {
  BrandList,
  BrandSort,
  CatalogStats,
  Category,
  CategoryWithBrands,
  CrawlerStatus,
  HealthStatus,
  ProductDetail,
  ProductList,
  ProductSort,
  ScanRun,
  SortDir,
} from "@/types/api";

const SERVER_API_URL = process.env.API_URL ?? "http://localhost:4100/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch tipado contra el backend NestJS. Pensado para Server Components:
 * por defecto no cachea, asi el SSR siempre refleja el estado real de la base.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit & { next?: NextFetchRequestConfig } = {},
): Promise<T> {
  const { headers, cache, ...rest } = init;

  const response = await fetch(`${SERVER_API_URL}${path}`, {
    ...rest,
    cache: cache ?? "no-store",
    headers: { "Content-Type": "application/json", ...headers },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `${rest.method ?? "GET"} ${path} respondio ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}

export function getStats(): Promise<CatalogStats> {
  return apiFetch<CatalogStats>("/catalog/stats");
}

export function getCategories(parent?: string): Promise<Category[]> {
  const query = parent ? `?parent=${encodeURIComponent(parent)}` : "";
  return apiFetch<Category[]>(`/catalog/categories${query}`);
}

export function getCategory(id: string): Promise<CategoryWithBrands> {
  return apiFetch<CategoryWithBrands>(`/catalog/categories/${id}`);
}

export function getBrands(params: {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: BrandSort;
  dir?: SortDir;
}): Promise<BrandList> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  if (params.dir) query.set("dir", params.dir);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiFetch<BrandList>(`/catalog/brands${suffix}`);
}

export function getProducts(params: {
  categoryId?: string;
  brandId?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: ProductSort;
  dir?: SortDir;
}): Promise<ProductList> {
  const query = new URLSearchParams();
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.brandId) query.set("brandId", params.brandId);
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.sort) query.set("sort", params.sort);
  if (params.dir) query.set("dir", params.dir);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiFetch<ProductList>(`/catalog/products${suffix}`);
}

export function getProduct(id: string): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/catalog/products/${id}`);
}

/** Estado del llenado progresivo. Lo muestra la barra lateral y el resumen. */
export function getCrawler(): Promise<CrawlerStatus> {
  return apiFetch<CrawlerStatus>("/catalog/crawler");
}

export function getScans(limit = 20): Promise<ScanRun[]> {
  return apiFetch<ScanRun[]>(`/catalog/scans?limit=${limit}`);
}

export function runScan(categoryId: string): Promise<ScanRun> {
  return apiFetch<ScanRun>(`/catalog/categories/${categoryId}/scan`, {
    method: "POST",
    body: JSON.stringify({ strategy: "catalog", seeds: 6, pages: 6 }),
  });
}
