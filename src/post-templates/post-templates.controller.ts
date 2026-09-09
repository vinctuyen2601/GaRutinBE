import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PostTemplatesService } from './post-templates.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PostTemplatesController {
  constructor(private readonly service: PostTemplatesService) {}

  /** Ô chọn trong trang soạn bài — chỉ khuôn đang bật. */
  @Get('admin/posts/templates')
  dangDung() {
    return this.service.dangDung();
  }

  /** Trang quản lý — gồm cả khuôn đã tắt. */
  @Get('admin/post-templates')
  tatCa() {
    return this.service.tatCa();
  }

  @Post('admin/post-templates')
  them(@Body() dto: { id: string; name: string; description?: string; brief: string; sortOrder?: number }) {
    return this.service.them(dto);
  }

  @Patch('admin/post-templates/:id')
  sua(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.service.sua(id, dto);
  }

  @Delete('admin/post-templates/:id')
  xoa(@Param('id') id: string) {
    return this.service.xoa(id);
  }

  @Post('admin/post-templates/:id/khoi-phuc')
  khoiPhuc(@Param('id') id: string) {
    return this.service.khoiPhuc(id);
  }
}
