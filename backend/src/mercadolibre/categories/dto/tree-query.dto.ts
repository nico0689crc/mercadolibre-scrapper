import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class TreeQueryDto {
  /** Categoria raiz del arbol. Si no se pasa, arranca de las raices del sitio. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}\d+$/, {
    message: 'root debe ser un id de categoria, ej. MLA1051',
  })
  root?: string;

  /** Niveles a expandir. 1 = solo hijos directos. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  depth = 1;
}
