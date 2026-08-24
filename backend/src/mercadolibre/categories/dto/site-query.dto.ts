import { IsOptional, IsString, Matches } from 'class-validator';

export class SiteQueryDto {
  /** Sitio de ML. Si no se pasa, usa ML_SITE_ID del entorno. */
  @IsOptional()
  @IsString()
  @Matches(/^M[A-Z]{2}$/, {
    message: 'siteId debe ser un id de sitio, ej. MLA',
  })
  siteId?: string;
}
