/** Formas de respuesta de la API de Mercado Libre que consumimos. */

export interface MlSite {
  id: string;
  name: string;
  default_currency_id: string;
}

export interface MlCategorySummary {
  id: string;
  name: string;
  total_items_in_this_category?: number;
}

export interface MlCategory {
  id: string;
  name: string;
  picture?: string;
  permalink?: string;
  total_items_in_this_category: number;
  path_from_root: MlCategorySummary[];
  children_categories: MlCategorySummary[];
  settings: Record<string, unknown>;
  meta_categ_id?: string | null;
  attributable?: boolean;
}

export interface MlAttributeValue {
  id: string;
  name: string;
}

export interface MlAttribute {
  id: string;
  name: string;
  value_type: string;
  hierarchy?: string;
  relevance?: number;
  tags?: Record<string, boolean>;
  values?: MlAttributeValue[];
}

export interface MlHighlightEntry {
  id: string;
  position: number;
  type: string;
}

export interface MlHighlights {
  content: MlHighlightEntry[];
}

export interface MlProductAttribute {
  id: string;
  name: string;
  value_id?: string | null;
  value_name?: string | null;
}

export interface MlPicture {
  id: string;
  url: string;
}

export interface MlProduct {
  id: string;
  name: string;
  domain_id: string;
  status: string;
  attributes: MlProductAttribute[];
  /** Todo esto ya viene en /products/search: persistirlo no cuesta requests. */
  pictures?: MlPicture[];
  short_description?: { type: string; content: string } | null;
  tags?: string[];
  quality_type?: string | null;
  parent_id?: string | null;
  children_ids?: string[];
  date_created?: string | null;
  last_updated?: string | null;
}

/** Respuesta de /products/{id}: agrega campos que el search no trae. */
export interface MlProductDetail extends MlProduct {
  permalink?: string | null;
  main_features?: { text: string }[] | null;
}

/** Una publicacion real de /products/{id}/items. */
export interface MlProductItem {
  item_id: string;
  seller_id: number;
  price: number;
  currency_id: string;
  condition: string;
}

export interface MlProductItems {
  paging?: { total: number };
  results: MlProductItem[];
}

export interface MlProductSearch {
  keywords?: string;
  paging: { total: number; limit: number; offset: number };
  results: MlProduct[];
}

export interface MlTrend {
  keyword: string;
  url: string;
}

/** Formas que exponemos nosotros. */

export interface CategoryNode {
  id: string;
  name: string;
  totalItems: number;
  children: CategoryNode[];
}

export interface CategoryDetail {
  id: string;
  name: string;
  totalItems: number;
  isLeaf: boolean;
  /** settings.catalog_domain, ej. MLA-CELLPHONES. Null si ML no lo define. */
  catalogDomain: string | null;
  path: MlCategorySummary[];
  children: MlCategorySummary[];
  permalink?: string;
}

export interface CategoryBrand {
  id: string | null;
  name: string;
  products: number;
}

/**
 * `highlights` mira los 15 productos mas vendidos de la categoria: una llamada,
 * respuesta inmediata, pero solo ve las marcas lideres.
 * `catalog` recorre el catalogo del dominio usando las busquedas mas populares
 * como semillas: mucho mas cobertura a cambio de mas requests.
 */
export type BrandStrategy = 'highlights' | 'catalog';

/** Resultado crudo de un scan: las marcas agregadas y los productos que las produjeron. */
export interface CategoryScan extends CategoryBrands {
  products: MlProduct[];
}

export interface CategoryBrands {
  categoryId: string;
  categoryName: string;
  domainId: string | null;
  strategy: BrandStrategy;
  /** Productos de catalogo efectivamente analizados. */
  sampled: number;
  /** Semillas de busqueda usadas (solo en la estrategia catalog). */
  keywords: string[];
  /**
   * Si la busqueda pudo acotarse al dominio de catalogo de la categoria.
   * Los dominios genericos (categorias raiz) no tienen productos de catalogo:
   * ahi se cae a una busqueda sin filtro de dominio y el resultado es mas ruidoso.
   */
  domainFiltered: boolean;
  brands: CategoryBrand[];
}
