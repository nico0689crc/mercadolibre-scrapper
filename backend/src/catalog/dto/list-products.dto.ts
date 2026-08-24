import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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
}
