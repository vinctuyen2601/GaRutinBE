import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { CreateGalleryItemDto, UpdateGalleryItemDto } from './dto/gallery-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class GalleryController {
  constructor(private service: GalleryService) {}

  @Get('gallery')
  findAll() {
    return this.service.findAll();
  }

  @Get('admin/gallery')
  @UseGuards(JwtAuthGuard)
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Post('admin/gallery')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateGalleryItemDto) {
    return this.service.create(dto);
  }

  @Patch('admin/gallery/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateGalleryItemDto) {
    return this.service.update(id, dto);
  }

  @Delete('admin/gallery/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
