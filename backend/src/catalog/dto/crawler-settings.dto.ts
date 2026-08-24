import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import type { BrandStrategy } from '../../mercadolibre/categories/category.types';

export class CrawlerSettingsDto {
  @IsOptional()
  @IsIn(['highlights', 'catalog'])
  strategy?: BrandStrategy;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  seeds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  pages?: number;

  /** Pausa entre categorias, en segundos. Es el freno principal del ritmo. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(3600)
  delaySeconds?: number;

  /** Dias tras los cuales una categoria ya escaneada vuelve a la cola. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  restaleDays?: number;
}
