import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT: number = 4100;

  @IsString()
  @IsNotEmpty()
  ML_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  ML_CLIENT_SECRET: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL: string;

  @IsUrl({ require_tld: false })
  PUBLIC_URL: string;

  /**
   * Railway inyecta DATABASE_URL. Si esta, las variables sueltas sobran; si no,
   * son obligatorias. Por eso van con @ValidateIf en vez de sueltas.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DATABASE_URL?: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number = 5432;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DATABASE_USER: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string;

  @ValidateIf((env: EnvironmentVariables) => !env.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string;

  @IsUrl({ require_tld: false })
  ML_REDIRECT_URI: string;

  @IsString()
  @IsNotEmpty()
  ML_SITE_ID: string;

  @IsUrl()
  ML_AUTH_DOMAIN: string;

  @IsUrl()
  ML_API_URL: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const detail = errors
      .map(
        (e) =>
          `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n');
    throw new Error(`Configuracion de entorno invalida:\n${detail}`);
  }

  return validated;
}
