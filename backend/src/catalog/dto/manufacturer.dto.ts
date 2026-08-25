import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { SEGMENTS } from '../segments';

const SEGMENT_KEYS = Object.keys(SEGMENTS);

export class SegmentDto {
  @IsIn(SEGMENT_KEYS, {
    message: `segment debe ser uno de: ${SEGMENT_KEYS.join(', ')}`,
  })
  segment: string;
}

export class ListManufacturersDto {
  @IsOptional()
  @IsIn(SEGMENT_KEYS)
  segment?: string;

  @IsOptional()
  @IsIn(['candidate', 'verified', 'rejected'])
  status?: 'candidate' | 'verified' | 'rejected';
}

export class CandidatesQueryDto {
  @IsIn(SEGMENT_KEYS, {
    message: `segment debe ser uno de: ${SEGMENT_KEYS.join(', ')}`,
  })
  segment: string;

  /**
   * Devolver tambien las que no superan el umbral, para revisar la cola.
   *
   * El ValidationPipe global tiene enableImplicitConversion, asi que el valor
   * puede llegar ya convertido a boolean: comparar solo contra el string
   * hacia que `includeAll=true` nunca tomara efecto.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeAll?: boolean;
}

export class AcceptManufacturerDto {
  /** Dominios oficiales de donde salen los manuales, ej. ["drean.com.ar"]. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^[a-z0-9.-]+\.[a-z]{2,}$/, {
    each: true,
    message: 'cada dominio debe ser un host valido, sin protocolo ni barra',
  })
  officialDomains: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectManufacturerDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
