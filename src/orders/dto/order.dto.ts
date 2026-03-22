import { IsString, IsOptional, IsArray, IsIn, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Type(() => Number)
  price: number;

  @IsString()
  unit: string;
}

export class CreateOrderDto {
  @IsString()
  customerName: string;

  @IsString()
  customerPhone: string;

  @IsString()
  @IsOptional()
  customerAddress?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  totalAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsIn(['web', 'zalo', 'phone', 'other'])
  @IsOptional()
  source?: 'web' | 'zalo' | 'phone' | 'other';
}

export class UpdateOrderStatusDto {
  @IsIn(['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'])
  status: 'pending' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled';
}
