import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Columnas por las que la tabla de categorias se puede ordenar. */
export const CATEGORY_SORT = [
  'name',
  'items',
  'depth',
  'brands',
  'products',
] as const;
export type CategorySort = (typeof CATEGORY_SORT)[number];

/** Filtro de tres estados: como llegan de un <select> del frontend. */
export const TRISTATE = ['any', 'yes', 'no'] as const;
export type Tristate = (typeof TRISTATE)[number];

const CATEGORY_ID = /^[A-Z]{3}\d+$/;

export class ListCategoriesDto {
  /** Hijas directas de esta categoria. Manda sobre `scope`. */
  @IsOptional()
  @IsString()
  @Matches(CATEGORY_ID, {
    message: 'parent debe ser un id de categoria, ej. MLA1055',
  })
  parent?: string;

  /** Esta categoria y toda su descendencia (usa el path_from_root guardado). */
  @IsOptional()
  @IsString()
  @Matches(CATEGORY_ID, {
    message: 'branch debe ser un id de categoria, ej. MLA1648',
  })
  branch?: string;

  /** `roots` = solo el primer nivel; `all` = todo el arbol. */
  @IsOptional()
  @IsIn(['roots', 'all'])
  scope: 'roots' | 'all' = 'roots';

  /** Busca en el nombre y en el id. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  depth?: number;

  /** Categorias hoja (sin hijas en ML). */
  @IsOptional()
  @IsIn(TRISTATE)
  leaf: Tristate = 'any';

  /** Con `settings.catalog_domain`, que es lo que hace util un scan. */
  @IsOptional()
  @IsIn(TRISTATE)
  domain: Tristate = 'any';

  /** Con al menos una marca ya detectada. */
  @IsOptional()
  @IsIn(TRISTATE)
  brands: Tristate = 'any';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minItems?: number;

  @IsOptional()
  @IsIn(CATEGORY_SORT)
  sort: CategorySort = 'items';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}
