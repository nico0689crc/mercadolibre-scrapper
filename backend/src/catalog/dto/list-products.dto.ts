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

export class ListProductsDto {
  /** Categoria bajo la que se encontro el producto. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}\d+$/, {
    message: 'categoryId debe ser un id de categoria, ej. MLA1055',
  })
  categoryId?: string;

  /** Uuid de la marca en nuestra base (el de GET /api/catalog/brands). */
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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
