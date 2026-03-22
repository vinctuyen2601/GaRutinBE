import {
  Controller, Post, Get, Delete, UseInterceptors, UploadedFile,
  UseGuards, BadRequestException, Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MediaService } from './media.service';
import * as path from 'path';

@Controller('admin/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private service: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file');
    const ext = path.extname(file.originalname) || '.jpg';
    const key = `garutin/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
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
