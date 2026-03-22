import {
  Controller, Post, UseInterceptors, UploadedFile,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { R2Service } from '../storage/r2.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as path from 'path';

@Controller('admin/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private r2: R2Service) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file');

    const ext = path.extname(file.originalname) || '.jpg';
    const key = `garutin/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const url = await this.r2.uploadBuffer(key, file.buffer, file.mimetype);
    return { url, key, originalName: file.originalname, size: file.size };
  }
}
