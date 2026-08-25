import type {
  BrandList,
  BrandSort,
  CatalogStats,
  CategoryList,
  CategoryNode,
  CategorySort,
  CategoryWithBrands,
  CrawlerStatus,
  DomainOption,
  HealthStatus,
  Manual,
  ManualStats,
  Manufacturer,
  ManufacturerSegment,
  ManufacturerStatus,
  Methodology,
  DomainResolution,
  SearchQuotaUsage,
  ProductDetail,
  ProductList,
  ProductSort,
  ProductStatus,
  ScanRun,
  SortDir,
  Tristate,
} from "@/types/api";

/** Arma el query string salteando lo vacio y los tri-estado en "any". */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "any") continue;
    search.set(key, String(value));
  }
  return search.size > 0 ? `?${search.toString()}` : "";
}

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

export interface CategoryFilters {
  parent?: string;
  /** Una categoria y toda su descendencia. */
  branch?: string;
  scope?: "roots" | "all";
  search?: string;
  depth?: number;
  leaf?: Tristate;
  domain?: Tristate;
  brands?: Tristate;
  minItems?: number;
  sort?: CategorySort;
  dir?: SortDir;
  limit?: number;
  offset?: number;
}

export function getCategories(
  filters: CategoryFilters = {},
): Promise<CategoryList> {
  return apiFetch<CategoryList>(`/catalog/categories${query({ ...filters })}`);
}

/** Arbol completo y liviano (~50 kB): lo consume la cascada de filtros. */
export function getCategoryTree(): Promise<CategoryNode[]> {
  return apiFetch<CategoryNode[]>("/catalog/categories/tree");
}

/** Dominios de catalogo presentes, para el select del filtro de productos. */
export function getDomains(params: {
  categoryId?: string;
  branch?: string;
}): Promise<DomainOption[]> {
  return apiFetch<DomainOption[]>(`/catalog/domains${query({ ...params })}`);
}

export function getCategory(id: string): Promise<CategoryWithBrands> {
  return apiFetch<CategoryWithBrands>(`/catalog/categories/${id}`);
}

export function getBrands(params: {
  limit?: number;
  offset?: number;
  search?: string;
  branch?: string;
  minProducts?: number;
  minCategories?: number;
  sort?: BrandSort;
  dir?: SortDir;
}): Promise<BrandList> {
  return apiFetch<BrandList>(`/catalog/brands${query({ ...params })}`);
}

export function getProducts(params: {
  categoryId?: string;
  branch?: string;
  brandId?: string;
  search?: string;
  domainId?: string;
  status?: ProductStatus;
  brand?: "any" | "none";
  photo?: Tristate;
  limit?: number;
  offset?: number;
  sort?: ProductSort;
  dir?: SortDir;
}): Promise<ProductList> {
  return apiFetch<ProductList>(`/catalog/products${query({ ...params })}`);
}

export function getProduct(id: string): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/catalog/products/${id}`);
}

/** Estado del llenado progresivo. Lo muestra la barra lateral y el resumen. */
export function getCrawler(): Promise<CrawlerStatus> {
  return apiFetch<CrawlerStatus>("/catalog/crawler");
}

export function getManufacturers(params: {
  segment?: string;
  status?: ManufacturerStatus;
}): Promise<Manufacturer[]> {
  return apiFetch<Manufacturer[]>(
    `/catalog/manufacturers${query({ ...params })}`,
  );
}

export function getMethodology(segment: string): Promise<Methodology> {
  return apiFetch<Methodology>(
    `/catalog/manufacturers/methodology${query({ segment })}`,
  );
}

export function getManufacturerSegments(): Promise<ManufacturerSegment[]> {
  return apiFetch<ManufacturerSegment[]>("/catalog/manufacturers/segments");
}

export function acceptManufacturer(
  brandId: string,
  body: { officialDomains: string[]; notes?: string },
): Promise<Manufacturer> {
  return apiFetch<Manufacturer>(`/catalog/manufacturers/${brandId}/accept`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function rejectManufacturer(
  brandId: string,
  body: { notes?: string },
): Promise<Manufacturer> {
  return apiFetch<Manufacturer>(`/catalog/manufacturers/${brandId}/reject`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resolveDomain(
  brandId: string,
  useSearch = true,
): Promise<DomainResolution> {
  return apiFetch<DomainResolution>(
    `/catalog/manufacturers/${brandId}/resolve-domain${useSearch ? "" : "?search=0"}`,
  );
}

export function getManuals(brandId?: string) {
  return apiFetch<Manual[]>(`/catalog/manuals${query({ brandId })}`);
}

export function getManualStats() {
  return apiFetch<ManualStats>("/catalog/manuals/stats");
}

export function getSearchQuota(): Promise<SearchQuotaUsage> {
  return apiFetch<SearchQuotaUsage>("/catalog/manufacturers/quota");
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
