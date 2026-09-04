import { IsString, IsIn, IsObject, IsArray, IsBoolean, IsOptional } from 'class-validator';

export class CreateNotificationChannelDto {
  @IsString()
  name: string;

  @IsIn(['telegram', 'zalo', 'email'])
  type: string;

  @IsObject()
  config: Record<string, string>;

  @IsArray()
  events: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateNotificationChannelDto {
  @IsString() @IsOptional() name?: string;
  @IsIn(['telegram', 'zalo', 'email']) @IsOptional() type?: string;
  @IsObject() @IsOptional() config?: Record<string, string>;
  @IsArray() @IsOptional() events?: string[];
  @IsBoolean() @IsOptional() isActive?: boolean;
}
