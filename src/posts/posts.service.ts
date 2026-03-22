import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly repo: Repository<Post>,
  ) {}

  findPublished(params: { category?: string; page?: number; limit?: number } = {}): Promise<Post[]> {
    const qb = this.repo.createQueryBuilder('p')
      .where(`p.status = 'published' AND p.deleted_at IS NULL`)
      .orderBy('p.published_at', 'DESC')
      .addOrderBy('p.created_at', 'DESC');

    if (params.category) qb.andWhere('p.category = :cat', { cat: params.category });

    const limit = params.limit ?? 10;
    const page = params.page ?? 1;
    qb.take(limit).skip((page - 1) * limit);

    return qb.getMany();
  }

  findAllAdmin(): Promise<Post[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findBySlug(slug: string): Promise<Post | null> {
    return this.repo.findOne({ where: { slug, status: 'published' } });
  }

  findById(id: string): Promise<Post | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CreatePostDto): Promise<Post> {
    const post = this.repo.create(dto);
    if (dto.status === 'published' && !dto.publishedAt) {
      post.publishedAt = new Date();
    }
    return this.repo.save(post);
  }

  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    const post = await this.findById(id);
    if (!post) throw new NotFoundException('Bài viết không tồn tại');
    if (dto.status === 'published' && post.status !== 'published' && !dto.publishedAt) {
      dto.publishedAt = new Date().toISOString();
    }
    Object.assign(post, dto);
    return this.repo.save(post);
  }

  async remove(id: string): Promise<void> {
    const post = await this.findById(id);
    if (!post) throw new NotFoundException('Bài viết không tồn tại');
    await this.repo.softDelete(id);
  }
}
