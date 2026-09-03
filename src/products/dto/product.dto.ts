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

  /** Link YouTube hoặc đường dẫn mp4 tự lưu. Web tự phân biệt từng phần tử. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  videos?: string[];

  /**
   * @deprecated Dùng `videos`. Giữ lại vì CMS trên Vercel deploy tách khỏi máy
   * chủ: có vài phút bản CMS cũ (ô video đơn) gọi API mới, mà API bật
   * forbidNonWhitelisted nên từ chối trường lạ — chủ trại sẽ không lưu được
   * sản phẩm trong khoảng đó. Service gộp giá trị này vào `videos`.
   */
  @IsString()
  @IsOptional()
  videoUrl?: string;

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

  /** Link YouTube hoặc đường dẫn mp4 tự lưu. Web tự phân biệt từng phần tử. */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  videos?: string[];

  /**
   * @deprecated Dùng `videos`. Giữ lại vì CMS trên Vercel deploy tách khỏi máy
   * chủ: có vài phút bản CMS cũ (ô video đơn) gọi API mới, mà API bật
   * forbidNonWhitelisted nên từ chối trường lạ — chủ trại sẽ không lưu được
   * sản phẩm trong khoảng đó. Service gộp giá trị này vào `videos`.
   */
  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;
}
