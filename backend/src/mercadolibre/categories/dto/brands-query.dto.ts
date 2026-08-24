import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import type { BrandStrategy } from '../category.types';

export class BrandsQueryDto {
  /**
   * `catalog` (default) barre el catalogo del dominio: mas cobertura, mas requests.
   * `highlights` mira solo los 15 productos mas vendidos: una llamada.
   */
  @IsOptional()
  @IsIn(['highlights', 'catalog'])
  strategy: BrandStrategy = 'catalog';

  /** Cuantas busquedas populares usar como semilla (solo en `catalog`). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  seeds = 6;

  /** Paginas de 50 productos por semilla (ML corta en offset 1000). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  pages = 8;
}
