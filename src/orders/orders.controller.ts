import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class OrdersController {
  constructor(private service: OrdersService) {}

  // Public: customer submits order from website
  @Post('orders')
  create(@Body() dto: CreateOrderDto) {
    return this.service.create(dto);
  }

  @Get('admin/orders')
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('admin/orders/:id')
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch('admin/orders/:id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
