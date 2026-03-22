import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import {
  GenerateProductDescriptionDto,
  OptimizeProductSeoDto,
  ImproveProductDescriptionDto,
} from './dto/ai-product.dto';
import { callLLM, parseJsonFromAI } from '../common/llm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
  ) {}

  findAll(
    params: {
      categoryId?: string;
      featured?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<Product[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.is_active = true AND p.deleted_at IS NULL')
      .orderBy('p.sort_order', 'ASC')
      .addOrderBy('p.created_at', 'DESC');

    if (params.categoryId)
      qb.andWhere('p.category_id = :cid', { cid: params.categoryId });
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

  async generateDescription(dto: GenerateProductDescriptionDto): Promise<{
    description: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
  }> {
    const priceHint = dto.price
      ? ` Giá: ${dto.price.toLocaleString('vi-VN')}₫.`
      : '';
    const weightHint = dto.weightPerUnit
      ? ` Trọng lượng: ${dto.weightPerUnit}/${dto.unit ?? 'con'}.`
      : '';
    const categoryHint = dto.category ? ` Danh mục: "${dto.category}".` : '';

    const text = await callLLM(
      [
        {
          role: 'system',
          content: `Bạn là chuyên gia viết mô tả sản phẩm cho trang trại Gà Rutin (garutin.com).
Viết mô tả hấp dẫn, chuyên nghiệp cho sản phẩm gà rutin/trứng gà rutin, tập trung vào lợi ích và đặc điểm nổi bật.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
        },
        {
          role: 'user',
          content: `Viết mô tả sản phẩm:
Tên: "${dto.name}"${categoryHint}${priceHint}${weightHint}

Trả về JSON:
{
  "description": "mô tả HTML đầy đủ (dùng <p>, <ul>, <li>, <strong>), 150-300 từ, nêu bật ưu điểm và công dụng",
  "slug": "slug-url-tieng-viet-khong-dau",
  "seoTitle": "SEO title tối ưu (50-60 ký tự)",
  "seoDescription": "meta description hấp dẫn (150-160 ký tự)"
}`,
        },
      ],
      { maxTokens: 1200, temperature: 0.7, profile: 'quality' },
    );

    return parseJsonFromAI(text, 'products');
  }

  async optimizeSeo(dto: OptimizeProductSeoDto): Promise<{
    seoTitle: string;
    seoDescription: string;
    slug: string;
    suggestions: string[];
  }> {
    const descSnippet =
      dto.description?.replace(/<[^>]+>/g, '').slice(0, 800) ?? '';

    const text = await callLLM(
      [
        {
          role: 'system',
          content: `Bạn là chuyên gia SEO cho website trang trại Gà Rutin (garutin.com).
Tối ưu SEO cho trang sản phẩm gà rutin/trứng cút.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
        },
        {
          role: 'user',
          content: `Tối ưu SEO cho sản phẩm:
Tên: "${dto.name}"
Mô tả: "${descSnippet}"
SEO Title hiện tại: "${dto.seoTitle || ''}"
SEO Description hiện tại: "${dto.seoDescription || ''}"
Slug hiện tại: "${dto.slug || ''}"

Trả về JSON:
{
  "seoTitle": "SEO title tối ưu (50-60 ký tự)",
  "seoDescription": "meta description hấp dẫn (150-160 ký tự)",
  "slug": "slug-toi-uu",
  "suggestions": ["gợi ý 1", "gợi ý 2", "gợi ý 3"]
}`,
        },
      ],
      { maxTokens: 600, temperature: 0.3, profile: 'quality' },
    );

    return parseJsonFromAI(text, 'products');
  }

  async improveDescription(dto: ImproveProductDescriptionDto): Promise<{
    description: string;
    improvements: string[];
  }> {
    const text = await callLLM(
      [
        {
          role: 'system',
          content: `Bạn là chuyên gia viết mô tả sản phẩm cho trang trại Gà Rutin.
Cải thiện mô tả sản phẩm: thêm thông tin hữu ích, cải thiện cấu trúc, tăng tính thuyết phục.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
        },
        {
          role: 'user',
          content: `Cải thiện mô tả sản phẩm:
Tên: "${dto.name}"
Danh mục: "${dto.category || 'chung'}"
Mô tả hiện tại: "${dto.description.replace(/<[^>]+>/g, '').slice(0, 1000)}"

Trả về JSON:
{
  "description": "mô tả HTML đã cải thiện (dùng <p>, <ul>, <li>, <strong>)",
  "improvements": ["thay đổi 1", "thay đổi 2", "thay đổi 3"]
}`,
        },
      ],
      { maxTokens: 1200, temperature: 0.5, profile: 'quality' },
    );

    return parseJsonFromAI(text, 'products');
  }
}
