import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ListBrandsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
