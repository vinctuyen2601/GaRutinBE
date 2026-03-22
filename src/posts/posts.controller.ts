import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class PostsController {
  constructor(private service: PostsService) {}

  @Get('posts')
  findAll(
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findPublished({
      category,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Get('posts/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get('admin/posts')
  @UseGuards(JwtAuthGuard)
  findAllAdmin() {
    return this.service.findAllAdmin();
  }

  @Post('admin/posts')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePostDto) {
    return this.service.create(dto);
  }

  @Patch('admin/posts/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdatePostDto) {
    return this.service.update(id, dto);
  }

  @Delete('admin/posts/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
