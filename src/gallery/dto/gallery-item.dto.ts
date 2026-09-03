import { IsString, IsOptional, IsIn, IsBoolean, IsNumber, IsDateString } from 'class-validator';

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
  @IsDateString()
  filmedAt?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  /**
   * Cho phép tạo ở trạng thái ẩn.
   *
   * Trước đây chỉ Update mới có trường này, mà máy chủ bật forbidNonWhitelisted
   * nên gửi kèm lúc tạo là bị từ chối 400. Chủ trại cần đăng trước rồi mới bật
   * hiện — ví dụ chuẩn bị sẵn video cho lứa hàng tuần sau.
   */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
  @IsDateString()
  filmedAt?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
