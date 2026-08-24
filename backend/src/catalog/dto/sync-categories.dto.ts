import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class SyncCategoriesDto {
  /** 1 = solo raices, 2 = raices + nivel 2 (457 en MLA), 3 = tres niveles. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  depth = 2;

  @IsOptional()
  @IsString()
  @Matches(/^M[A-Z]{2}$/, {
    message: 'siteId debe ser un id de sitio, ej. MLA',
  })
  siteId?: string;
}
