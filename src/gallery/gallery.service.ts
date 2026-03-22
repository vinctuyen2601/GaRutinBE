import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GalleryItem } from './entities/gallery-item.entity';
import { CreateGalleryItemDto, UpdateGalleryItemDto } from './dto/gallery-item.dto';

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(GalleryItem)
    private repo: Repository<GalleryItem>,
  ) {}

  findAll() {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  findAllAdmin() {
    return this.repo.find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
  }

  async create(dto: CreateGalleryItemDto) {
    const item = this.repo.create({ ...dto, source: dto.source ?? 'admin' });
    return this.repo.save(item);
  }

  async update(id: string, dto: UpdateGalleryItemDto) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy gallery item');
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy gallery item');
    await this.repo.remove(item);
    return { success: true };
  }
}
