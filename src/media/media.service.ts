import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaFile } from './entities/media-file.entity';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(MediaFile)
    private readonly repo: Repository<MediaFile>,
    private readonly r2: R2Service,
  ) {}

  async upload(key: string, file: Express.Multer.File): Promise<MediaFile> {
    const url = await this.r2.uploadBuffer(key, file.buffer, file.mimetype);
    const record = this.repo.create({
      url,
      key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
    return this.repo.save(record);
  }

  findAll(): Promise<MediaFile[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async remove(id: string): Promise<void> {
    const file = await this.repo.findOne({ where: { id } });
    if (!file) throw new NotFoundException('File không tồn tại');
    await this.r2.deleteObject(file.key);
    await this.repo.delete(id);
  }
}
