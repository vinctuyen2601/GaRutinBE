import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  price: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  salePrice?: number;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  weightPerUnit?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsIn(['in_stock', 'out_of_stock', 'pre_order'])
  @IsOptional()
  stockStatus?: 'in_stock' | 'out_of_stock' | 'pre_order';

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  salePrice?: number;

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  weightPerUnit?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsIn(['in_stock', 'out_of_stock', 'pre_order'])
  @IsOptional()
  stockStatus?: 'in_stock' | 'out_of_stock' | 'pre_order';

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;
}
