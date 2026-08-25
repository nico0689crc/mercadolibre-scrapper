/** Contrato compartido con el backend NestJS. Mantener en sync con backend/src. */

export interface HealthStatus {
  status: "ok";
  env: string;
  siteId: string;
  timestamp: string;
}

export interface CatalogStats {
  categories: number;
  brands: number;
  categoryBrandLinks: number;
  products: number;
  scans: number;
}

export interface Category {
  id: string;
  siteId: string;
  name: string;
  parentId: string | null;
  totalItems: number;
  catalogDomain: string | null;
  isLeaf: boolean;
  depth: number;
  path: { id: string; name: string }[];
  syncedAt: string | null;
}

/** Fila del listado de categorias: la categoria y lo que ya juntamos de ella. */
export interface CategoryListItem extends Category {
  brandsCount: number;
  productsCount: number;
}

export interface CategoryList {
  total: number;
  items: CategoryListItem[];
}

/** Nodo minimo del arbol, para la cascada de filtros. */
export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  isLeaf: boolean;
}

export interface StoredBrand {
  id: string;
  mlValueId: string | null;
  name: string;
  products: number;
  productsMax: number;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CategoryWithBrands {
  category: Category;
  children: Category[];
  brands: StoredBrand[];
}

export interface BrandListItem {
  id: string;
  mlValueId: string | null;
  name: string;
  categories: number;
  products: number;
}

export interface BrandList {
  total: number;
  items: BrandListItem[];
}

export interface ProductListItem {
  id: string;
  name: string;
  thumbnail: string | null;
  domainId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  lastSeenAt: string;
}

export interface ProductList {
  total: number;
  items: ProductListItem[];
}

export interface ProductAttribute {
  id: string;
  name: string;
  value_id?: string | null;
  value_name?: string | null;
}

export interface ProductDetail {
  id: string;
  siteId: string;
  domainId: string | null;
  categoryId: string | null;
  brandId: string | null;
  name: string;
  status: string;
  thumbnail: string | null;
  shortDescription: string | null;
  attributes: ProductAttribute[];
  pictures: { id: string; url: string }[];
  tags: string[];
  qualityType: string | null;
  parentId: string | null;
  childrenCount: number;
  mlDateCreated: string | null;
  mlLastUpdated: string | null;
  permalink: string | null;
  mainFeatures: string[];
  listingsCount: number | null;
  sellersCount: number | null;
  priceMin: string | null;
  priceMax: string | null;
  currencyId: string | null;
  detailFetchedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  brand: { id: string; name: string; mlValueId: string | null } | null;
  category: { id: string; name: string } | null;
}

/** Orden de las tablas paginadas. Debe coincidir con los DTO del backend. */
export type SortDir = "asc" | "desc";
export type BrandSort = "name" | "categories" | "products";
export type ProductSort = "name" | "brand" | "category" | "lastSeenAt";
export type CategorySort = "name" | "items" | "depth" | "brands" | "products";

/** Filtros de tres estados, tal como viajan en la query. */
export type Tristate = "any" | "yes" | "no";
export type ProductStatus = "active" | "inactive";

export interface DomainOption {
  domainId: string;
  products: number;
}

export interface CrawlerStatus {
  enabled: boolean;
  strategy: string;
  seeds: number;
  pages: number;
  delaySeconds: number;
  restaleDays: number;
  lastCategoryId: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  running: boolean;
  pending: number;
  done: number;
}

export type ScanStatus = "running" | "ok" | "error";

export interface ScanRun {
  id: string;
  categoryId: string;
  strategy: string;
  seeds: number;
  pages: number;
  keywords: string[];
  domainFiltered: boolean;
  sampled: number;
  brandsFound: number;
  brandsNew: number;
  productsStored: number;
  durationMs: number;
  status: ScanStatus;
  error: string | null;
  createdAt: string;
}

export type ManufacturerStatus = "candidate" | "verified" | "rejected";

export interface Manufacturer {
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
  verifiedAt: string | null;
}

/** Una marca del segmento con las señales que se evaluaron sobre ella. */
export interface SignalRow {
  brandId: string;
  brand: string;
  status: ManufacturerStatus | null;
  products: number;
  models: number;
  gtinPct: number;
  gtinValidPct: number;
}

export interface Methodology {
  segment: string;
  label: string;
  domains: number;
  thresholds: { minProducts: number; minModels: number };
  funnel: { brandsInSegment: number; candidates: number };
  counts: Record<ManufacturerStatus, number>;
  signals: SignalRow[];
}

export interface ManufacturerSegment {
  key: string;
  label: string;
  domains: number;
}

export interface DomainCandidate {
  domain: string;
  sources: ("heuristic" | "search")[];
  score: number;
  httpStatus: number | null;
  looksOfficial: boolean;
}

export interface DomainResolution {
  brand: string;
  slug: string;
  best: DomainCandidate | null;
  agreement: boolean;
  candidates: DomainCandidate[];
  usedSearch: boolean;
}

export interface SearchQuotaUsage {
  used: number;
  quota: number;
  period: string;
}

/** Por que creemos que el PDF es el manual de ese modelo. */
export type ManualMatchReason =
  "url" | "contenido" | "pagina" | "resultado" | "tokens";

export interface Manual {
  id: string;
  brand: string;
  model: string;
  modelRaw: string;
  url: string;
  sourceDomain: string;
  bytes: number | null;
  matchReason: ManualMatchReason | null;
  verified: boolean;
  checkedAt: string | null;
  /** Producto de la misma marca cuyo modelo coincide, si lo tenemos. */
  productId: string | null;
  productName: string | null;
  /** Cuantos productos comparten ese modelo: el PDF cubre a todos. */
  productCount: number;
}

export interface ManualStats {
  total: number;
  verified: number;
  brands: number;
}
