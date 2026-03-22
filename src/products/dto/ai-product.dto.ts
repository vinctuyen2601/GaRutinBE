import { IsString, IsOptional, IsNumber } from 'class-validator';

export class GenerateProductDescriptionDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  weightPerUnit?: string;

  @IsString()
  @IsOptional()
  unit?: string;
}

export class OptimizeProductSeoDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsString()
  @IsOptional()
  slug?: string;
}

export class ImproveProductDescriptionDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  category?: string;
}
