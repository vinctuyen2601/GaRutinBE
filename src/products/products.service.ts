import { Injectable, NotFoundException } from '@nestjs/common';
import { AiPromptsService } from '../ai-prompts/ai-prompts.service';
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

/**
 * Cắt chuỗi về đúng trần ký tự, cắt ở ranh giới TỪ.
 *
 * Giới hạn độ dài là thứ mô hình ngôn ngữ bỏ qua đều đặn: prompt ghi "tuyệt
 * đối không quá 158 ký tự", chạy thử vẫn ra 182. Thêm chữ vào prompt để nài nỉ
 * chỉ làm phần suy luận dài thêm — đúng thứ vừa làm hỏng cả lệnh. Trần độ dài
 * là ràng buộc đo được nên ép bằng mã, dứt điểm.
 *
 * Cắt ở khoảng trắng cuối cùng chứ không cắt giữa từ: Google hiện nguyên văn
 * chuỗi này, một từ đứt đôi trông như trang hỏng.
 */
function catVua(chuoi: string | undefined, tran: number): string {
  const t = (chuoi ?? '').trim();
  if (t.length <= tran) return t;
  const cat = t.slice(0, tran);
  const khoang = cat.lastIndexOf(' ');
  // Không có khoảng trắng nào (một từ dài bất thường) thì đành cắt cứng.
  return (khoang > tran * 0.6 ? cat.slice(0, khoang) : cat).replace(/[\s,;:.-]+$/, '');
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly repo: Repository<Product>,
    private readonly aiPrompts: AiPromptsService,
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
      .orderBy('p.sort_order', 'DESC')
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
      order: { sortOrder: 'DESC', createdAt: 'DESC' },
    });
  }

  findBySlug(slug: string): Promise<Product | null> {
    return this.repo.findOne({ where: { slug, isActive: true } });
  }

  findById(id: string): Promise<Product | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Gộp trường videoUrl cũ (một video) vào mảng videos, rồi loại nó khỏi
   * payload.
   *
   * Cần loại hẳn chứ không chỉ bỏ qua: `Object.assign(product, dto)` bên dưới
   * sẽ gắn videoUrl thành một thuộc tính rác trên entity, và TypeORM không có
   * cột tương ứng nên hoặc lỗi hoặc âm thầm trôi vào bản ghi.
   *
   * Chỉ dùng videoUrl khi videos KHÔNG được gửi lên. CMS mới luôn gửi videos
   * (kể cả mảng rỗng khi xoá hết), nên điều kiện này để bản CMS mới không bị
   * bản cũ ghi đè ngược.
   */
  private chuanHoaVideo<T extends { videos?: string[]; videoUrl?: string }>(
    dto: T,
  ): Omit<T, 'videoUrl'> {
    const { videoUrl, ...rest } = dto;
    if (videoUrl && rest.videos === undefined) {
      return { ...rest, videos: [videoUrl] } as Omit<T, 'videoUrl'>;
    }
    return rest as Omit<T, 'videoUrl'>;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.repo.create(this.chuanHoaVideo(dto));
    return this.repo.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);
    if (!product) throw new NotFoundException('Sản phẩm không tồn tại');
    Object.assign(product, this.chuanHoaVideo(dto));
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
          content: await this.aiPrompts.lay('product.generate-description'),
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
      { maxTokens: 2000, temperature: 0.7, profile: 'quality', jsonMode: true },
    );

    const kq = parseJsonFromAI<Record<string, unknown>>(text, 'products');
    // Ép trần độ dài ngay tại đây, trước khi trả cho CMS: người quản trị nhìn
    // ô đã điền sẵn và bấm lưu, hiếm khi đi đếm ký tự.
    if (typeof kq.seoTitle === 'string') kq.seoTitle = catVua(kq.seoTitle, 60);
    if (typeof kq.seoDescription === 'string') kq.seoDescription = catVua(kq.seoDescription, 158);
    return kq as never;
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
          content: await this.aiPrompts.lay('product.optimize-seo'),
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
      { maxTokens: 1500, temperature: 0.3, profile: 'quality', jsonMode: true },
    );

    const kq = parseJsonFromAI<Record<string, unknown>>(text, 'products');
    // Ép trần độ dài ngay tại đây, trước khi trả cho CMS: người quản trị nhìn
    // ô đã điền sẵn và bấm lưu, hiếm khi đi đếm ký tự.
    if (typeof kq.seoTitle === 'string') kq.seoTitle = catVua(kq.seoTitle, 60);
    if (typeof kq.seoDescription === 'string') kq.seoDescription = catVua(kq.seoDescription, 158);
    return kq as never;
  }

  async improveDescription(dto: ImproveProductDescriptionDto): Promise<{
    description: string;
    improvements: string[];
  }> {
    const text = await callLLM(
      [
        {
          role: 'system',
          content: await this.aiPrompts.lay('product.improve-description'),
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
      { maxTokens: 2000, temperature: 0.5, profile: 'quality', jsonMode: true },
    );

    const kq = parseJsonFromAI<Record<string, unknown>>(text, 'products');
    // Ép trần độ dài ngay tại đây, trước khi trả cho CMS: người quản trị nhìn
    // ô đã điền sẵn và bấm lưu, hiếm khi đi đếm ký tự.
    if (typeof kq.seoTitle === 'string') kq.seoTitle = catVua(kq.seoTitle, 60);
    if (typeof kq.seoDescription === 'string') kq.seoDescription = catVua(kq.seoDescription, 158);
    return kq as never;
  }
}
