import { Injectable, Logger } from '@nestjs/common';

export interface ExtractedContent {
  url: string;
  title: string;
  excerpt: string;
  content: string;
  wordCount: number;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  async fetchAndExtract(rawUrl: string): Promise<ExtractedContent | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`Failed to fetch ${rawUrl}: HTTP ${res.status}`);
        return null;
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return null;

      const html = await res.text();
      return this.extractContent(rawUrl, html);
    } catch (e: any) {
      this.logger.warn(`Error fetching ${rawUrl}: ${e.message}`);
      return null;
    }
  }

  private extractContent(url: string, html: string): ExtractedContent {
    // Title: ưu tiên og:title → <title>
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = (ogTitleMatch?.[1] || titleMatch?.[1] || '').replace(/\s+/g, ' ').trim();

    // Excerpt: ưu tiên og:description → meta description
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const excerpt = (ogDescMatch?.[1] || metaDescMatch?.[1] || '').trim();

    // Xóa script, style, nav, footer, header, aside
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ');

    // Ưu tiên lấy nội dung trong <article>, <main>, hoặc div có class content/article/post
    const articleMatch = cleaned.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentDiv = cleaned.match(/<div[^>]+(?:class|id)=["'][^"']*(?:content|article|post|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const contentHtml = articleMatch?.[1] || mainMatch?.[1] || contentDiv?.[1] || cleaned;

    // Strip HTML tags → plain text
    const text = contentHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    const content = text.slice(0, 5000);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    return { url, title, excerpt, content, wordCount };
  }
}
