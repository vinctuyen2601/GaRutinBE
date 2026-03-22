import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class GenerateContentDto {
  @IsString()
  topic: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsOptional()
  keywords?: string[];
}

export class OptimizeSeoDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];
}

export class ImproveContentDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsOptional()
  contentScore?: number;

  @IsArray()
  @IsOptional()
  issues?: string[];
}
