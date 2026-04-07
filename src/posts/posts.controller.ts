import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Header } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { GenerateContentDto, OptimizeSeoDto, ImproveContentDto, GenerateFromUrlDto, CrawlToDraftsDto } from './dto/ai-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
export class PostsController {
  constructor(private service: PostsService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  getSitemap() {
    return this.service.generateSitemap();
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  getRobots() {
    const siteUrl = process.env.SITE_URL || 'https://garutin.com';
    return `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
  }

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

  @Post('admin/posts/ai/generate')
  @UseGuards(JwtAuthGuard)
  generateContent(@Body() dto: GenerateContentDto) {
    return this.service.generateContent(dto);
  }

  @Post('admin/posts/ai/generate-from-url')
  @UseGuards(JwtAuthGuard)
  generateFromUrl(@Body() dto: GenerateFromUrlDto) {
    return this.service.generateFromUrl(dto);
  }

  @Post('admin/posts/ai/optimize-seo')
  @UseGuards(JwtAuthGuard)
  optimizeSeo(@Body() dto: OptimizeSeoDto) {
    return this.service.optimizeSeo(dto);
  }

  @Post('admin/posts/ai/improve')
  @UseGuards(JwtAuthGuard)
  improveContent(@Body() dto: ImproveContentDto) {
    return this.service.improveContent(dto);
  }

  @Post('admin/posts/ai/crawl-to-drafts')
  @UseGuards(JwtAuthGuard)
  crawlToDrafts(@Body() dto: CrawlToDraftsDto) {
    return this.service.crawlToDrafts(dto);
  }
}
