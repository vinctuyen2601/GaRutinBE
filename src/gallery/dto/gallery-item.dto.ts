import { IsString, IsOptional, IsIn, IsBoolean, IsNumber } from 'class-validator';

export class CreateGalleryItemDto {
  @IsIn(['image', 'video'])
  type: 'image' | 'video';

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsIn(['admin', 'customer'])
  source?: 'admin' | 'customer';

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateGalleryItemDto {
  @IsOptional()
  @IsIn(['image', 'video'])
  type?: 'image' | 'video';

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsIn(['admin', 'customer'])
  source?: 'admin' | 'customer';

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
