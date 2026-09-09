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
import { PostTemplatesService } from '../post-templates/post-templates.service';
import { AiPromptsService } from '../ai-prompts/ai-prompts.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly repo: Repository<Post>,
    private readonly crawlerService: CrawlerService,
    private readonly searchService: SearchService,
    private readonly keywordsService: KeywordsService,
    private readonly aiPrompts: AiPromptsService,
    private readonly postTemplates: PostTemplatesService,
  ) {}

  async findPublished(params: { category?: string; page?: number; limit?: number; q?: string } = {}): Promise<{ data: Post[]; total: number; page: number; limit: number }> {
    const qb = this.repo.createQueryBuilder('p')
      .where(`p.status = 'published' AND p.deleted_at IS NULL`)
      .orderBy('p.published_at', 'DESC')
      .addOrderBy('p.created_at', 'DESC');

    if (params.category) qb.andWhere('p.category = :cat', { cat: params.category });
    if (params.q) qb.andWhere('(p.title ILIKE :q OR p.excerpt ILIKE :q)', { q: `%${params.q}%` });

    const limit = params.limit ?? 12;
    const page = params.page ?? 1;
    qb.take(limit).skip((page - 1) * limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
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
          content: await this.aiPrompts.lay('post.generate-from-url'),
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
          content: await this.aiPrompts.lay('post.generate'),
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

  /**
   * Dựng prompt tối ưu SEO, tách khỏi việc gọi LLM.
   *
   * Tách ra để đường gọi API và đường làm tay (copy prompt sang chat AI rồi dán
   * kết quả về) dùng CHUNG đúng một bộ prompt. Chép prompt sang chỗ khác thì
   * sớm muộn hai bên lệch nhau, mà lệch kiểu này không báo lỗi — chỉ cho ra kết
   * quả khác nhau tuỳ hôm đó bấm nút nào.
   */
  async promptOptimizeSeo(dto: OptimizeSeoDto): Promise<{ system: string; user: string }> {
    const contentSnippet = dto.content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    const template = await this.postTemplates.tra(dto.templateId);
    const templateNote = template
      ? `\n- Bài viết đang theo cấu trúc "${template.name}" (${template.description}) — manualSuggestions PHẢI phù hợp với cấu trúc này, KHÔNG đề xuất thêm FAQ nếu cấu trúc này không cần FAQ, không đề xuất CTA cứng nếu cấu trúc yêu cầu CTA lồng tự nhiên`
      : '';

    // Prompt lấy từ registry để CMS sửa được; không có bản ghi đè
    // thì rơi về đúng nội dung mặc định trong src/ai-prompts/registry.ts.
    const systemPrompt = await this.aiPrompts.lay('post.optimize-seo', { templateNote });

    const userPrompt = `Tiêu đề bài viết: ${dto.title}

Nội dung bài viết:
${contentSnippet}

Thông tin hiện tại (có thể rỗng):
- seoTitle hiện tại: ${dto.seoTitle || '(chưa có)'}
- seoDescription hiện tại: ${dto.seoDescription || '(chưa có)'}
- slug hiện tại: ${dto.slug || '(chưa có)'}
- tags hiện tại: ${dto.tags?.join(', ') || '(chưa có)'}`;

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * Đọc kết quả SEO từ văn bản AI trả về.
   *
   * Dùng chung cho cả hai đường, nên dán tay hay gọi API đều đi qua đúng một bộ
   * kiểm tra: thiếu trường thành rỗng, tags không phải mảng thành mảng rỗng,
   * JSON hỏng thì báo cùng một lỗi.
   */
  docKetQuaSeo(rawText: string): {
    seoTitle: string;
    seoDescription: string;
    slug: string;
    tags: string[];
    suggestions: string[];
    manualSuggestions: string[];
  } {
    const parsed = parseJsonFromAI<Record<string, any>>(rawText, 'optimizeSeo');

    return {
      seoTitle: parsed.seoTitle ?? '',
      seoDescription: parsed.seoDescription ?? '',
      slug: parsed.slug ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      manualSuggestions: Array.isArray(parsed.manualSuggestions) ? parsed.manualSuggestions : [],
    };
  }

  async optimizeSeo(dto: OptimizeSeoDto): Promise<{
    seoTitle: string;
    seoDescription: string;
    slug: string;
    tags: string[];
    suggestions: string[];
    manualSuggestions: string[];
  }> {
    const { system, user } = await this.promptOptimizeSeo(dto);
    const rawText = await callLLM(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      // Trần token phải rộng hơn nhiều so với độ dài JSON mong đợi (~500 token).
      // Lý do: gpt-oss-120b là mô hình reasoning và token suy luận bị TÍNH VÀO
      // max_tokens, nên phần lớn hạn mức bị phần suy luận ăn mất và JSON hiện ra
      // bị cắt giữa chừng. Đặt 800 rồi 2000 đều vẫn cắt; 6000 mới đủ chỗ.
      // Trần rộng không làm chậm hay tốn thêm — mô hình vẫn dừng khi viết xong.
      //
      // profile 'fast' (groq trước) chứ không phải 'quality' (gemini trước).
      //
      // Đây chỉ là mấy dòng metadata, không phải bài viết — groq thừa sức. Mà
      // trên thực tế 'quality' đang KHÔNG cho chất lượng cao hơn: gemini đang
      // treo, nên mọi lần gọi đều mất trọn hạn chờ rồi rơi xuống groq và trả
      // về đúng kết quả của groq. Xếp gemini trước chỉ tổ mất thêm thời gian.
      //
      // Thời gian là thứ quyết định ở đây: CloudFront cắt kết nối ở 30 giây,
      // nên tổng thời gian phải nằm gọn dưới mốc đó. 10 giây mỗi lần thử nghĩa
      // là kể cả nhà cung cấp đầu treo, nhà cung cấp sau vẫn kịp trả lời.
      { maxTokens: 6000, temperature: 0.3, profile: 'fast', timeoutMs: 10_000 },
    );

    // parseJsonFromAI (src/common/llm.ts) thay cho bản tự viết: nó thử thêm
    // hai cách nữa — bóc code block nằm giữa chuỗi, và sửa xuống dòng lọt trong
    // chuỗi JSON — rồi tự ghi log kèm độ dài và ném lỗi khi chịu thua.
    return this.docKetQuaSeo(rawText);
  }


  /**
   * Dựng prompt cải thiện nội dung, tách khỏi việc gọi LLM.
   *
   * Cùng lý do như promptOptimizeSeo: đường gọi API và đường làm tay phải dùng
   * chung một bộ prompt, nếu không hai bên lệch nhau mà không có gì báo.
   */
  async promptImproveContent(dto: ImproveContentDto): Promise<{ system: string; user: string }> {
    const issuesList = (dto.issues ?? []).map((i) => `- ${i}`).join('\n');
    const scoreContext = dto.contentScore !== undefined
      ? `Điểm chất lượng hiện tại: ${dto.contentScore}/100.\n`
      : '';

    const template = await this.postTemplates.tra(dto.templateId);
    // Lấy brief qua registry chứ không đọc thẳng template.brief: có vậy thì sửa
    // cấu trúc bài trong CMS mới thật sự đổi thứ gửi cho AI. Không có bản ghi
    // đè thì registry trả về đúng brief mặc định trong post-templates.ts.
    const structureRule = template
      ? `4. ${template.brief}`
      : `4. Nếu thiếu FAQ: thêm section cuối bài với ít nhất 3 thẻ <h3> kết thúc bằng "?" + đoạn trả lời <p> ngắn
5. Nếu thiếu CTA: thêm link tự nhiên <a href="/san-pham">xem sản phẩm</a> hoặc đề cập "Gà Rutin"
6. Nếu thiếu internal link: thêm ít nhất 1 <a href="/blog/...">bài liên quan</a> phù hợp ngữ cảnh`;

    // Prompt lấy từ registry để CMS sửa được; không có bản ghi đè
    // thì rơi về đúng nội dung mặc định trong src/ai-prompts/registry.ts.
    const systemPrompt = await this.aiPrompts.lay('post.improve', { structureRule });

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

    return { system: systemPrompt, user: userPrompt };
  }

  /**
   * Đọc kết quả cải thiện nội dung từ văn bản AI trả về.
   *
   * KHÔNG phải JSON như phần SEO, mà là định dạng phân cách ===HTML=== và
   * ===EXCERPT===. Lý do giữ nguyên: bài viết là HTML dài, nhét vào chuỗi JSON
   * thì mọi dấu nháy và xuống dòng đều phải thoát, và chỉ cần mô hình quên một
   * dấu là hỏng cả bài. Phân cách bằng dòng đánh dấu thì bền hơn hẳn.
   *
   * Người dán tay cũng phải theo đúng định dạng này — prompt đã ghi rõ.
   */
  docKetQuaImprove(rawText: string): {
    content: string;
    excerpt: string;
    summary: string;
  } {
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

  async improveContent(dto: ImproveContentDto): Promise<{
    content: string;
    excerpt: string;
    summary: string;
  }> {
    const { system, user } = await this.promptImproveContent(dto);
    const rawText = await callLLM(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      { maxTokens: 6000, temperature: 0.4, profile: 'quality' },
    );
    return this.docKetQuaImprove(rawText);
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
                content: await this.aiPrompts.lay('post.crawl-rewrite'),
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
                content: await this.aiPrompts.lay('post.crawl-seo'),
              },
              {
                role: 'user',
                content: `Keyword: "${activeKeyword.keyword}"
Tiêu đề: ${rewriteTitle}
Nội dung: ${contentSnippet}`,
              },
            ],
            // Cùng lý do như optimizeSeo: token suy luận ăn vào max_tokens,
            // và groq trước cho kịp trần 30 giây của CloudFront.
            { maxTokens: 6000, temperature: 0.3, profile: 'fast', timeoutMs: 10_000 },
          );

          let seo: { seoTitle?: string; seoDescription?: string; slug?: string; tags?: string[] } = {};
          try {
            seo = parseJsonFromAI(seoRaw, 'crawl-to-drafts/seo');
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
