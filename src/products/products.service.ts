import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  findAll(params: { categoryId?: string; featured?: boolean; page?: number; limit?: number } = {}): Promise<Product[]> {
    const qb = this.repo.createQueryBuilder('p')
      .where('p.is_active = true AND p.deleted_at IS NULL')
      .orderBy('p.sort_order', 'ASC')
      .addOrderBy('p.created_at', 'DESC');

    if (params.categoryId) qb.andWhere('p.category_id = :cid', { cid: params.categoryId });
    if (params.featured) qb.andWhere('p.is_featured = true');

    const limit = params.limit ?? 20;
    const page = params.page ?? 1;
    qb.take(limit).skip((page - 1) * limit);

    return qb.getMany();
  }

  findAllAdmin(): Promise<Product[]> {
    return this.repo.find({
      withDeleted: false,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  findBySlug(slug: string): Promise<Product | null> {
    return this.repo.findOne({ where: { slug, isActive: true } });
  }

  findById(id: string): Promise<Product | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.repo.create(dto);
    return this.repo.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    Object.assign(product, dto);
    return this.repo.save(product);
  }

  async remove(id: string): Promise<void> {
    const product = await this.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    await this.repo.softDelete(id);
  }
}
