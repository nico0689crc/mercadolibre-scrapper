import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** Columnas por las que la tabla de marcas se puede ordenar. */
export const BRAND_SORT = ['name', 'categories', 'products'] as const;
export type BrandSort = (typeof BRAND_SORT)[number];

export class ListBrandsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Marcas presentes en esta categoria o en cualquiera de sus descendientes. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}\d+$/, {
    message: 'branch debe ser un id de categoria, ej. MLA1648',
  })
  branch?: string;

  /** Piso de productos acumulados (suma de products_max por categoria). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minProducts?: number;

  /** Piso de categorias distintas en las que aparece la marca. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCategories?: number;

  @IsOptional()
  @IsIn(BRAND_SORT)
  sort: BrandSort = 'products';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir: 'asc' | 'desc' = 'desc';
}
