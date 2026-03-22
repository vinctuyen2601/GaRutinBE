import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  findAll(activeOnly = true): Promise<Category[]> {
    return this.repo.find({
      where: activeOnly ? { isActive: true } : {},
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.repo.findOne({ where: { slug, isActive: true } });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const cat = this.repo.create(dto);
    return this.repo.save(cat);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Danh mục không tồn tại');
    Object.assign(cat, dto);
    return this.repo.save(cat);
  }

  async remove(id: string): Promise<void> {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Danh mục không tồn tại');
    await this.repo.remove(cat);
  }
}
