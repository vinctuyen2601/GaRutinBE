import {
  Controller, Post, Get, Delete, UseInterceptors, UploadedFile,
  UseGuards, BadRequestException, Param, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';
import * as path from 'path';

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';
}

@Controller('admin/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private service: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('name') name?: string,
  ) {
    if (!file) throw new BadRequestException('Không có file');
    const ext = path.extname(file.originalname) || '.jpg';
    const raw = name || path.basename(file.originalname, ext);
    const key = `garutin/${toSlug(raw)}-${Date.now()}${ext}`;
    const saved = await this.service.upload(key, file);
    return saved;
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
