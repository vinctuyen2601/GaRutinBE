import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateKeywordDto {
  @IsString()
  keyword: string;

  @IsString()
  @IsOptional()
  category?: string;
}

export class UpdateKeywordDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
