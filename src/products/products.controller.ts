import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import {
  GenerateProductDescriptionDto,
  OptimizeProductSeoDto,
  ImproveProductDescriptionDto,
} from './dto/ai-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class ProductsController {
  constructor(private service: ProductsService) {}

  @Get('products')
  findAll(
    @Query('category') categoryId?: string,
    @Query('featured') featured?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      categoryId,
      featured: featured === 'true',
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('products/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get('admin/products')
  @UseGuards(JwtAuthGuard)
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Post('admin/products')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch('admin/products/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete('admin/products/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('admin/products/ai/generate-description')
  @UseGuards(JwtAuthGuard)
  generateDescription(@Body() dto: GenerateProductDescriptionDto) {
    return this.service.generateDescription(dto);
  }

  @Post('admin/products/ai/optimize-seo')
  @UseGuards(JwtAuthGuard)
  optimizeSeo(@Body() dto: OptimizeProductSeoDto) {
    return this.service.optimizeSeo(dto);
  }

  @Post('admin/products/ai/improve-description')
  @UseGuards(JwtAuthGuard)
  improveDescription(@Body() dto: ImproveProductDescriptionDto) {
    return this.service.improveDescription(dto);
  }
}
