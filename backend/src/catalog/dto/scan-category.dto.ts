import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import type { BrandStrategy } from '../../mercadolibre/categories/category.types';

export class ScanCategoryDto {
  @IsOptional()
  @IsIn(['highlights', 'catalog'])
  strategy: BrandStrategy = 'catalog';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  seeds = 6;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  pages = 8;
}
