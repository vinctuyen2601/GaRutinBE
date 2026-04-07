import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { GenerateContentDto, OptimizeSeoDto, ImproveContentDto, GenerateFromUrlDto, CrawlToDraftsDto } from './dto/ai-post.dto';
import { callLLM, parseJsonFromAI } from '../common/llm';
import { CrawlerService } from './crawler.service';
import { SearchService } from './search.service';
import { KeywordsService } from '../keywords/keywords.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly repo: Repository<Post>,
    private readonly crawlerService: CrawlerService,
    private readonly searchService: SearchService,
    private readonly keywordsService: KeywordsService,
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
    manualSuggestions: string[];
  }> {
    const contentSnippet = dto.content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    const systemPrompt = `Bạn là chuyên gia SEO cho garutin.com — website trang trại Gà Rutin chuyên về gà rutin (chim cút Nhật Bản), trứng cút, kỹ thuật chăn nuôi.
Nhiệm vụ: Tối ưu hóa metadata SEO cho bài viết, giúp rank cao trên Google Việt Nam.

Quy tắc NGHIÊM NGẶT:
- seoTitle: 50-60 ký tự — từ khóa chính PHẢI xuất hiện ở đầu, dùng power words (Bí quyết/Top N/Cách/Hướng dẫn), tránh dùng tên brand
- seoDescription: 145-158 ký tự — cấu trúc: Hook(vấn đề người dùng) + Giải pháp ngắn + CTA (Khám phá/Tìm hiểu ngay). KHÔNG bắt đầu bằng "Bài viết" hay "Chúng tôi"
- slug: 3-6 từ tiếng Việt không dấu, có từ khóa chính, chỉ a-z0-9 và dấu gạch ngang, không có "bai-viet" hay "huong-dan" ở đầu
- tags: mảng 5-7 tags — 2 broad keyword ngắn (1-2 từ) + 3-4 long-tail keyword (3-5 từ) — là những gì người Việt hay tìm trên Google về gà rutin
- manualSuggestions: mảng gợi ý cụ thể cần chỉnh tay — ưu tiên: (1) thêm internal link đến /san-pham hoặc /blog/category/X với anchor text tự nhiên, (2) thêm H3 câu hỏi "?" + đoạn trả lời ngắn để có FAQ schema, (3) bổ sung số liệu/thống kê cụ thể về gà rutin
- suggestions: mô tả ngắn những thay đổi AI đã thực hiện

Chỉ trả về JSON thuần (không markdown):
{"seoTitle":"...","seoDescription":"...","slug":"...","tags":[...],"suggestions":[...],"manualSuggestions":[]}`;

    const userPrompt = `Tiêu đề bài viết: ${dto.title}

Nội dung bài viết:
${contentSnippet}

Thông tin hiện tại (có thể rỗng):
- seoTitle hiện tại: ${dto.seoTitle || '(chưa có)'}
- seoDescription hiện tại: ${dto.seoDescription || '(chưa có)'}
- slug hiện tại: ${dto.slug || '(chưa có)'}
- tags hiện tại: ${dto.tags?.join(', ') || '(chưa có)'}`;

    const rawText = await callLLM(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { maxTokens: 800, temperature: 0.3, profile: 'quality' },
    );

    let parsed: Record<string, any> = {};
    try {
      const json = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      parsed = JSON.parse(json);
    } catch {
      throw new Error('AI trả về dữ liệu không hợp lệ, thử lại');
    }

    return {
      seoTitle: parsed.seoTitle ?? '',
      seoDescription: parsed.seoDescription ?? '',
      slug: parsed.slug ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      manualSuggestions: Array.isArray(parsed.manualSuggestions) ? parsed.manualSuggestions : [],
    };
  }

  async improveContent(dto: ImproveContentDto): Promise<{
    content: string;
    excerpt: string;
    summary: string;
  }> {
    const issuesList = (dto.issues ?? []).map((i) => `- ${i}`).join('\n');
    const scoreContext = dto.contentScore !== undefined
      ? `Điểm chất lượng hiện tại: ${dto.contentScore}/100.\n`
      : '';

    const systemPrompt = `Bạn là chuyên gia biên tập nội dung cho garutin.com — website trang trại Gà Rutin chuyên về gà rutin (chim cút Nhật Bản).
Nhiệm vụ: Cải thiện bài viết HTML để tăng điểm chất lượng nội dung, giúp rank tốt hơn trên Google Việt Nam.

NGUYÊN TẮC BẮT BUỘC:
1. Fix TOÀN BỘ các vấn đề được liệt kê trong danh sách
2. Giữ nguyên thông tin cốt lõi, cấu trúc bài — KHÔNG bịa số liệu hay thông tin không có trong bài gốc
3. Thêm context thực tế: giá VND (200k, 500k...), địa danh VN, mùa vụ, kinh nghiệm nuôi gà rutin thực tế
4. Nếu thiếu FAQ: thêm section cuối bài với ít nhất 3 thẻ <h3> kết thúc bằng "?" + đoạn trả lời <p> ngắn
5. Nếu thiếu CTA: thêm link tự nhiên <a href="/san-pham">xem sản phẩm</a> hoặc đề cập "Gà Rutin"
6. Nếu thiếu internal link: thêm ít nhất 1 <a href="/blog/...">bài liên quan</a> phù hợp ngữ cảnh
7. Giọng văn: thân thiện, chuyên môn — phù hợp người nuôi gia cầm Việt Nam
8. Nếu bài ngắn (< 800 từ): mở rộng các section hiện có, KHÔNG thêm nội dung vô nghĩa
9. Output PHẢI là HTML hợp lệ (<h2>, <h3>, <p>, <ul>, <ol>, <li>, <a>, <strong>) — KHÔNG dùng markdown

FORMAT OUTPUT BẮT BUỘC (giữ đúng 3 dòng delimiter):
SUMMARY: [một dòng tóm tắt những gì đã thêm/sửa, ví dụ: Đã thêm FAQ 3 câu, +400 từ, CTA /san-pham, 1 internal link]
===EXCERPT===
[tóm tắt 1-2 câu hấp dẫn cho bài viết]
===HTML===
[toàn bộ HTML nội dung bài viết đã cải thiện]`;

    const cleanContent = dto.content
      .replace(/\s+style="[^"]*"/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);

    const userPrompt = `Tiêu đề: ${dto.title}
Danh mục: ${dto.category ?? 'chung'}
${scoreContext}
Các vấn đề cần khắc phục (PHẢI fix tất cả):
${issuesList || '- Tổng thể cải thiện chất lượng nội dung'}

Nội dung HTML hiện tại:
${cleanContent}`;

    const rawText = await callLLM(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { maxTokens: 6000, temperature: 0.4, profile: 'quality' },
    );

    // Parse delimiter format
    const htmlDelimiter = '===HTML===';
    const excerptDelimiter = '===EXCERPT===';
    const htmlIdx = rawText.indexOf(htmlDelimiter);
    const excerptIdx = rawText.indexOf(excerptDelimiter);

    if (htmlIdx !== -1) {
      const beforeHtml = rawText.slice(0, htmlIdx).trim();
      const htmlContent = rawText.slice(htmlIdx + htmlDelimiter.length).trim();
      const cleanHtml = htmlContent.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();

      const summaryMatch = beforeHtml.match(/^SUMMARY:\s*(.+)$/im);
      const summary = summaryMatch?.[1]?.trim() ?? 'Nội dung đã được cải thiện.';

      let excerpt = '';
      if (excerptIdx !== -1 && excerptIdx < htmlIdx) {
        const excerptRaw = rawText.slice(excerptIdx + excerptDelimiter.length, htmlIdx).trim();
        excerpt = excerptRaw.replace(/<[^>]+>/g, '').trim();
      }

      if (cleanHtml) return { content: cleanHtml, excerpt, summary };
    }

    // Fallback: AI trả về HTML thẳng
    const stripped = rawText.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim();
    if (stripped.startsWith('<')) {
      return { content: stripped, excerpt: '', summary: 'Nội dung đã được cải thiện.' };
    }

    throw new Error('AI trả về dữ liệu không hợp lệ, thử lại');
  }

  async crawlToDrafts(dto: CrawlToDraftsDto): Promise<{
    keyword: string;
    created: Post[];
    errors: { url: string; reason: string }[];
  }> {
    // 1. Lấy keyword đang active
    const activeKeyword = await this.keywordsService.findActive();
    if (!activeKeyword) {
      throw new NotFoundException('Không có keyword nào đang active. Vui lòng activate một keyword trước.');
    }

    const limit = Math.min(dto.limit ?? 3, 3);

    // 2. Search Google lấy URLs
    const searchResults = await this.searchService.searchGoogle(activeKeyword.keyword, limit);
    if (!searchResults.length) {
      throw new NotFoundException('Không tìm được URL nào từ keyword này. Kiểm tra SERPER_API_KEY.');
    }

    const created: Post[] = [];
    const errors: { url: string; reason: string }[] = [];

    const LANG_LABEL: Record<string, string> = {
      vi: 'tiếng Việt', ja: 'tiếng Nhật', ko: 'tiếng Hàn', en: 'tiếng Anh',
    };

    for (const { url, lang } of searchResults) {
      try {
          // 3. Crawl & extract
          // Kiểm tra URL này đã được crawl chưa
          const existing = await this.repo.findOne({ where: { sourceUrl: url } });
          if (existing) {
            errors.push({ url, reason: `Đã crawl trước đó (bài: "${existing.title}")` });
            continue;
          }

          const extracted = await this.crawlerService.fetchAndExtract(url);
          if (!extracted || extracted.wordCount < 100) {
            errors.push({ url, reason: 'Trang không có đủ nội dung để xử lý' });
            continue;
          }

          // 4. AI viết lại + cải thiện trong 1 call (rewrite + improve gộp)
          const categoryHint = activeKeyword.category ? ` Danh mục: "${activeKeyword.category}".` : '';
          const langNote = lang !== 'vi'
            ? ` Nội dung gốc bằng ${LANG_LABEL[lang] ?? lang} — dịch và viết lại hoàn toàn bằng tiếng Việt.`
            : '';
          const rewriteRaw = await callLLM(
            [
              {
                role: 'system',
                content: `Bạn là chuyên gia viết nội dung cho trang trại Gà Rutin (garutin.com) chuyên về gà rutin (chim cút Nhật Bản).
Nhiệm vụ: đọc nội dung từ nguồn, viết thành bài viết hoàn chỉnh bằng tiếng Việt theo góc nhìn trang trại Gà Rutin.
YÊU CẦU BẮT BUỘC:
- Không copy nguyên văn, thêm thông tin thực tế Việt Nam (giá VND, kinh nghiệm nuôi)
- Tối thiểu 700 từ, dùng <h2>, <h3>, <p>, <ul>, <li>, <strong>
- Thêm section FAQ cuối bài: ít nhất 3 thẻ <h3> kết thúc bằng "?" + đoạn <p> trả lời ngắn
- Thêm 1 link CTA tự nhiên: <a href="/san-pham">xem sản phẩm</a>

FORMAT OUTPUT BẮT BUỘC (3 dòng delimiter, không thêm gì khác):
TITLE: [tiêu đề mới hấp dẫn, có keyword]
===EXCERPT===
[tóm tắt 1-2 câu hấp dẫn]
===HTML===
[toàn bộ HTML nội dung bài viết]`,
              },
              {
                role: 'user',
                content: `Viết bài cho website Gà Rutin.${categoryHint}${langNote}
Keyword: "${activeKeyword.keyword}"
Tiêu đề gốc: "${extracted.title}"
Mô tả gốc: "${extracted.excerpt}"
Nội dung gốc:
"${extracted.content}"`,
              },
            ],
            { maxTokens: 4000, temperature: 0.7, profile: 'quality' },
          );

          // Parse delimiter format
          const titleMatch = rewriteRaw.match(/^TITLE:\s*(.+)$/im);
          const rewriteTitle = titleMatch?.[1]?.trim() ?? extracted.title;
          const htmlDelim = '===HTML===';
          const excerptDelim = '===EXCERPT===';
          const hIdx = rewriteRaw.indexOf(htmlDelim);
          const eIdx = rewriteRaw.indexOf(excerptDelim);
          let improvedContent = hIdx !== -1
            ? rewriteRaw.slice(hIdx + htmlDelim.length).trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim()
            : extracted.content;
          let improvedExcerpt = (eIdx !== -1 && hIdx !== -1 && eIdx < hIdx)
            ? rewriteRaw.slice(eIdx + excerptDelim.length, hIdx).trim().replace(/<[^>]+>/g, '').trim()
            : extracted.excerpt;

          // 5. Tối ưu SEO
          const contentSnippet = improvedContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
          const seoRaw = await callLLM(
            [
              {
                role: 'system',
                content: `Bạn là chuyên gia SEO cho garutin.com — website trang trại Gà Rutin.
Quy tắc NGHIÊM NGẶT:
- seoTitle: 50-60 ký tự — keyword PHẢI xuất hiện ở đầu, dùng power words
- seoDescription: 145-158 ký tự — Hook + Giải pháp + CTA. KHÔNG bắt đầu bằng "Bài viết"
- slug: 3-6 từ tiếng Việt không dấu, chỉ a-z0-9 và dấu gạch ngang
- tags: 5-7 tags — 2 broad (1-2 từ) + 3-4 long-tail (3-5 từ)
Chỉ trả về JSON thuần: {"seoTitle":"...","seoDescription":"...","slug":"...","tags":[...]}`,
              },
              {
                role: 'user',
                content: `Keyword: "${activeKeyword.keyword}"
Tiêu đề: ${rewriteTitle}
Nội dung: ${contentSnippet}`,
              },
            ],
            { maxTokens: 600, temperature: 0.3, profile: 'quality' },
          );

          let seo: { seoTitle?: string; seoDescription?: string; slug?: string; tags?: string[] } = {};
          try {
            seo = JSON.parse(seoRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''));
          } catch {
            seo = {};
          }

          // 7. Slug unique
          let baseSlug = seo.slug || rewriteTitle
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 80);
          let slug = baseSlug;
          let counter = 2;
          while (await this.repo.findOne({ where: { slug } })) {
            slug = `${baseSlug}-${counter++}`;
          }

          // 8. Lưu draft gắn với keyword
          const post = this.repo.create({
            title: rewriteTitle,
            slug,
            content: improvedContent,
            excerpt: improvedExcerpt,
            category: activeKeyword.category,
            tags: seo.tags ?? [],
            seoTitle: seo.seoTitle ?? '',
            seoDescription: seo.seoDescription ?? '',
            keywordId: activeKeyword.id,
            sourceUrl: url,
            status: 'draft',
          });
          const saved = await this.repo.save(post);
          created.push(saved);
        } catch (e: any) {
          errors.push({ url, reason: e.message ?? 'Lỗi không xác định' });
        }
    }

    // 9. Cập nhật thống kê keyword
    if (created.length > 0) {
      await this.keywordsService.markCrawled(activeKeyword.id);
    }

    return { keyword: activeKeyword.keyword, created, errors };
  }

  async generateSitemap(): Promise<string> {
    const siteUrl = process.env.SITE_URL || 'https://garutin.com';
    const posts = await this.repo.find({
      where: { status: 'published' },
      select: ['slug', 'updatedAt'],
      order: { updatedAt: 'DESC' },
    });

    const urls = posts.map((p) => `
  <url>
    <loc>${siteUrl}/blog/${p.slug}</loc>
    <lastmod>${p.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;
  }

}
