import { IsString, IsOptional, IsArray, IsIn, IsDateString } from 'class-validator';

export class CreatePostDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsIn(['draft', 'published', 'archived'])
  @IsOptional()
  status?: 'draft' | 'published' | 'archived';

  @IsDateString()
  @IsOptional()
  publishedAt?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;
}

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsIn(['draft', 'published', 'archived'])
  @IsOptional()
  status?: 'draft' | 'published' | 'archived';

  @IsDateString()
  @IsOptional()
  publishedAt?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;
}
