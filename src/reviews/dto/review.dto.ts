import {
  IsString, IsInt, Min, Max, IsOptional, IsArray, ArrayMaxSize, IsUUID,
  MaxLength, MinLength, IsBoolean, IsUrl,
} from 'class-validator';

/** Số ảnh và video tối đa cho một đánh giá. Web và máy chủ dùng chung con số. */
export const TOI_DA_ANH = 3;

export class CreateReviewDto {
  @IsUUID()
  productId: string;

  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên của bạn' })
  @MaxLength(120, { message: 'Tên quá dài' })
  customerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsInt({ message: 'Vui lòng chọn số sao' })
  @Min(1, { message: 'Vui lòng chọn số sao' })
  @Max(5)
  rating: number;

  // Bắt buộc có nội dung: đánh giá chỉ có sao thì người đọc không rút ra được
  // gì, mà vẫn chiếm chỗ và vẫn phải duyệt.
  @IsString()
  @MinLength(10, { message: 'Nhận xét cần ít nhất 10 ký tự' })
  @MaxLength(2000, { message: 'Nhận xét quá dài (tối đa 2000 ký tự)' })
  comment: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TOI_DA_ANH, { message: `Tối đa ${TOI_DA_ANH} ảnh` })
  @IsUrl({}, { each: true, message: 'Ảnh không hợp lệ' })
  images?: string[];

  @IsOptional()
  @IsUrl({}, { message: 'Video không hợp lệ' })
  video?: string;
}

export class UpdateReviewDto {
  @IsOptional() @IsBoolean()
  isApproved?: boolean;

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;

  @IsOptional() @IsString() @MaxLength(120)
  customerName?: string;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  rating?: number;
}
