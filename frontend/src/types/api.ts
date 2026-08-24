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
