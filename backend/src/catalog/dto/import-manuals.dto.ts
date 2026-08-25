import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Un manual tal como lo exporta otro entorno.
 *
 * Viaja con el **nombre** de la marca y no con su id: los uuid son por base y
 * no coinciden entre entornos, asi que del otro lado hay que resolverlos.
 */
export class ImportManualDto {
  @IsString()
  @MaxLength(128)
  brand: string;

  @IsString()
  @MaxLength(128)
  modelRaw: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url: string;

  @IsString()
  @MaxLength(128)
  sourceDomain: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  foundAtUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  bytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sha256?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  matchReason?: string;
}

export class ImportManualsDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportManualDto)
  manuals: ImportManualDto[];

  /**
   * Consultas que el otro entorno ya le gasto a Brave este mes. El cupo es de
   * la cuenta, no del entorno: si cada uno cuenta solo lo suyo, entre los dos
   * se pasan del limite real.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  searchQuotaUsed?: number;
}
