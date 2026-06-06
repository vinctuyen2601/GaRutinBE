import { Controller, Post, Body, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  @Post('track')
  async track(
    @Body() body: { platform?: string; path: string },
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip;
    const userAgent = req.headers['user-agent'] || '';
    await this.service.track({ platform: body.platform || 'web', path: body.path, ip, userAgent });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/analytics/visits')
  getVisitStats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getVisitStats(from, to);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/analytics/table')
  getVisitTable(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('path') path?: string,
  ) {
    return this.service.getVisitTable({ from, to, path });
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/analytics/orders')
  getOrderStats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getOrderStats(from, to);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/analytics/top-products')
  getTopProducts(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getTopProducts(from, to, limit ? parseInt(limit) : 20);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/analytics/monthly-compare')
  getMonthlyCompare() {
    return this.service.getMonthlyCompare();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/analytics/product-conversion')
  getProductConversion(@Query('from') from: string, @Query('to') to: string) {
    return this.service.getProductConversion(from, to);
  }
}
