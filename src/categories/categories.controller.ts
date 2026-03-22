import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class CategoriesController {
  constructor(private service: CategoriesService) {}

  @Get('categories')
  findAll() {
    return this.service.findAll(true);
  }

  @Get('categories/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get('admin/categories')
  @UseGuards(JwtAuthGuard)
  findAllAdmin() {
    return this.service.findAll(false);
  }

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateCategoryDto) {
    return this.service.create(dto);
  }

  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
