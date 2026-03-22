import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { GenerateContentDto, OptimizeSeoDto, ImproveContentDto, GenerateFromUrlDto } from './dto/ai-post.dto';
import { callLLM, parseJsonFromAI } from '../common/llm';

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

  async generateFromUrl(dto: GenerateFromUrlDto): Promise<{
    title: string;
    content: string;
    excerpt: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
    tags: string[];
    sourceUrl: string;
  }> {
    // Fetch trang web
    let html: string;
    try {
      const res = await fetch(dto.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GaRutinBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: any) {
      throw new Error(`Không thể tải trang: ${e.message}`);
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    const metaDesc = metaMatch ? metaMatch[1].trim() : '';

    // Strip HTML → plain text, giữ khoảng trắng
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 4000);

    if (text.length < 100) {
      throw new Error('Trang web không có đủ nội dung để xử lý');
    }

    const categoryHint = dto.category ? ` Danh mục đích: "${dto.category}".` : '';

    const aiText = await callLLM(
      [
        {
          role: 'system',
          content: `Bạn là chuyên gia viết nội dung cho trang trại Gà Rutin (garutin.com) chuyên về gà rutin (chim cút Nhật Bản).
Nhiệm vụ: đọc nội dung từ URL được cung cấp, viết lại thành bài viết mới hoàn toàn phù hợp với chủ đề gà rutin.
Không copy nguyên văn — phải viết lại theo góc nhìn của trang trại Gà Rutin, thêm thông tin thực tế về gà rutin.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
        },
        {
          role: 'user',
          content: `Viết lại bài viết từ nội dung sau cho website trang trại Gà Rutin.${categoryHint}

Tiêu đề gốc: "${pageTitle}"
Mô tả gốc: "${metaDesc}"
Nội dung gốc (trích):
"${text}"

Trả về JSON:
{
  "title": "tiêu đề mới hấp dẫn liên quan gà rutin",
  "content": "nội dung HTML hoàn chỉnh (dùng <h2>, <h3>, <p>, <ul>, <li>, <strong>), tối thiểu 500 từ, viết lại góc nhìn gà rutin",
  "excerpt": "tóm tắt 1-2 câu",
  "slug": "slug-url-tieng-viet-khong-dau",
  "seoTitle": "SEO title tối ưu (50-60 ký tự)",
  "seoDescription": "meta description hấp dẫn (150-160 ký tự)",
  "tags": ["tag1", "tag2", "tag3", "tag4"]
}`,
        },
      ],
      { maxTokens: 3000, temperature: 0.7, profile: 'quality' },
    );

    const result = parseJsonFromAI(aiText, 'generateFromUrl');
    return { ...result, sourceUrl: dto.url };
  }

  async generateContent(dto: GenerateContentDto): Promise<{
    title: string;
    content: string;
    excerpt: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
    tags: string[];
  }> {
    const categoryHint = dto.category ? ` trong danh mục "${dto.category}"` : '';
    const keywordsHint = dto.keywords?.length ? ` Từ khóa cần tích hợp: ${dto.keywords.join(', ')}.` : '';

    const text = await callLLM(
      [
        {
          role: 'system',
          content: `Bạn là chuyên gia viết nội dung cho trang trại Gà Rutin (chim cút Nhật Bản).
Viết bài blog chuyên sâu, hữu ích về nuôi gà rutin, trứng cút, sức khỏe gia cầm, kỹ thuật chăn nuôi.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
        },
        {
          role: 'user',
          content: `Viết bài viết hoàn chỉnh về chủ đề: "${dto.topic}"${categoryHint}.${keywordsHint}

Trả về JSON với cấu trúc:
{
  "title": "tiêu đề hấp dẫn",
  "content": "nội dung HTML đầy đủ (dùng <h2>, <h3>, <p>, <ul>, <li>, <strong>), tối thiểu 600 từ",
  "excerpt": "tóm tắt 1-2 câu",
  "slug": "slug-url-tieng-viet-khong-dau",
  "seoTitle": "SEO title tối ưu (50-60 ký tự)",
  "seoDescription": "meta description hấp dẫn (150-160 ký tự)",
  "tags": ["tag1", "tag2", "tag3"]
}`,
        },
      ],
      { maxTokens: 3000, temperature: 0.7, profile: 'quality' },
    );

    return parseJsonFromAI(text, 'generateContent');
  }

  async optimizeSeo(dto: OptimizeSeoDto): Promise<{
    seoTitle: string;
    seoDescription: string;
    slug: string;
    tags: string[];
    suggestions: string[];
  }> {
    const contentSnippet = dto.content.replace(/<[^>]+>/g, '').slice(0, 1500);

    const text = await callLLM(
      [
        {
          role: 'system',
          content: `Bạn là chuyên gia SEO cho website trang trại Gà Rutin (garutin.com).
Phân tích và tối ưu SEO cho bài viết về nuôi gà rutin, trứng gà rutin.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
        },
        {
          role: 'user',
          content: `Tối ưu SEO cho bài viết:
Tiêu đề: "${dto.title}"
Nội dung (trích): "${contentSnippet}"
SEO Title hiện tại: "${dto.seoTitle || ''}"
SEO Description hiện tại: "${dto.seoDescription || ''}"
Slug hiện tại: "${dto.slug || ''}"
Tags hiện tại: ${JSON.stringify(dto.tags || [])}

Trả về JSON:
{
  "seoTitle": "SEO title tối ưu (50-60 ký tự)",
  "seoDescription": "meta description hấp dẫn (150-160 ký tự)",
  "slug": "slug-toi-uu-tieng-viet-khong-dau",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "suggestions": ["gợi ý cải thiện SEO 1", "gợi ý 2", "gợi ý 3"]
}`,
        },
      ],
      { maxTokens: 1000, temperature: 0.3, profile: 'quality' },
    );

    return parseJsonFromAI(text, 'optimizeSeo');
  }

  async improveContent(dto: ImproveContentDto): Promise<{
    content: string;
    excerpt: string;
    improvements: string[];
  }> {
    const issuesHint = dto.issues?.length ? `\nVấn đề cần khắc phục: ${dto.issues.join(', ')}` : '';
    const scoreHint = dto.contentScore !== undefined ? `\nĐiểm chất lượng hiện tại: ${dto.contentScore}/100` : '';
    const contentSnippet = dto.content.replace(/<[^>]+>/g, '').slice(0, 2000);

    const text = await callLLM(
      [
        {
          role: 'system',
          content: `Bạn là chuyên gia biên tập nội dung cho trang trại Gà Rutin.
Cải thiện chất lượng bài viết: thêm thông tin chuyên sâu, cải thiện cấu trúc, tăng tính hữu ích cho người nuôi gà rutin.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
        },
        {
          role: 'user',
          content: `Cải thiện bài viết:
Tiêu đề: "${dto.title}"
Danh mục: "${dto.category || 'chung'}"${scoreHint}${issuesHint}
Nội dung hiện tại (trích):
"${contentSnippet}"

Trả về JSON:
{
  "content": "nội dung HTML đã cải thiện hoàn chỉnh (dùng <h2>, <h3>, <p>, <ul>, <li>, <strong>)",
  "excerpt": "tóm tắt mới hấp dẫn hơn",
  "improvements": ["thay đổi đã thực hiện 1", "thay đổi 2", "thay đổi 3"]
}`,
        },
      ],
      { maxTokens: 3000, temperature: 0.5, profile: 'quality' },
    );

    return parseJsonFromAI(text, 'improveContent');
  }
}
