import { Controller, Get, Patch, Delete, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CreateCustomerDto {
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() address?: string;
}

class UpdateCustomerDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() phone?: string;
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Post('admin/customers')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCustomerDto) {
    return this.svc.create(dto.phone, dto.name, dto.address);
  }

  @Get('phone/:phone')
  findByPhone(@Param('phone') phone: string) {
    return this.svc.findByPhone(phone);
  }

  @Get('admin/customers/deleted')
  @UseGuards(JwtAuthGuard)
  findDeleted() {
    return this.svc.findDeleted();
  }

  @Get('admin/customers')
  @UseGuards(JwtAuthGuard)
  findAll(@Query('search') search?: string) {
    return this.svc.findAll(search);
  }

  @Get('admin/customers/:id')
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch('admin/customers/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.svc.update(id, dto);
  }

  @Delete('admin/customers/:id')
  @UseGuards(JwtAuthGuard)
  softDelete(@Param('id') id: string) {
    return this.svc.softDelete(id);
  }
}
