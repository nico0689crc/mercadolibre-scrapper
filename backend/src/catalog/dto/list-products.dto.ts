import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Columnas por las que la tabla de productos se puede ordenar. */
export const PRODUCT_SORT = [
  'name',
  'brand',
  'category',
  'lastSeenAt',
] as const;
export type ProductSort = (typeof PRODUCT_SORT)[number];

export const PRODUCT_STATUS = ['active', 'inactive'] as const;

export class ListProductsDto {
  /** Categoria bajo la que se encontro el producto. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}\d+$/, {
    message: 'categoryId debe ser un id de categoria, ej. MLA1055',
  })
  categoryId?: string;

  /**
   * Categoria y toda su descendencia. Es lo que se quiere casi siempre: el
   * `category_id` del producto es la hoja donde lo vio el scan, asi que
   * filtrar una raiz por `categoryId` no devuelve nada.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}\d+$/, {
    message: 'branch debe ser un id de categoria, ej. MLA1648',
  })
  branch?: string;

  /** Uuid de la marca en nuestra base (el de GET /api/catalog/brands). */
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Dominio de catalogo de ML, ej. MLA-NOTEBOOKS. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  domainId?: string;

  @IsOptional()
  @IsIn(PRODUCT_STATUS)
  status?: (typeof PRODUCT_STATUS)[number];

  /** `none` = solo los que quedaron sin marca resuelta. */
  @IsOptional()
  @IsIn(['any', 'none'])
  brand: 'any' | 'none' = 'any';

  /** Con o sin miniatura guardada. */
  @IsOptional()
  @IsIn(['any', 'yes', 'no'])
  photo: 'any' | 'yes' | 'no' = 'any';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsIn(PRODUCT_SORT)
  sort: ProductSort = 'name';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir: 'asc' | 'desc' = 'asc';
}
