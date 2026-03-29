import { Injectable, Logger } from '@nestjs/common';

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  lang: string;
}

// Các domain mạng xã hội / video không có đủ nội dung bài viết
const BLOCKED_DOMAINS = [
  'facebook.com', 'fb.com',
  'youtube.com', 'youtu.be',
  'tiktok.com',
  'instagram.com',
  'twitter.com', 'x.com',
  'pinterest.com',
  'reddit.com',
  'zalo.me',
  'threads.net',
];

function isBlockedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const LANG_CONFIGS = [
  { lang: 'vi', hl: 'vi', gl: 'vn' },
  { lang: 'ja', hl: 'ja', gl: 'jp' },
  { lang: 'ko', hl: 'ko', gl: 'kr' },
  { lang: 'en', hl: 'en', gl: 'us' },
];

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  /**
   * Search đa ngôn ngữ: vi → ja → ko → en
   * Lấy đủ `limit` kết quả hợp lệ (bỏ qua social/video)
   */
  async searchGoogle(keyword: string, limit = 3): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      this.logger.warn('SERPER_API_KEY chưa được cấu hình');
      return [];
    }

    const collected: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const { lang, hl, gl } of LANG_CONFIGS) {
      if (collected.length >= limit) break;

      const needed = limit - collected.length;
      // Lấy dư để bù cho các URL bị lọc
      const fetchNum = Math.min(needed * 3, 10);

      const results = await this.fetchSerper(apiKey, keyword, hl, gl, fetchNum);

      for (const item of results) {
        if (collected.length >= limit) break;
        if (seenUrls.has(item.url)) continue;
        if (isBlockedUrl(item.url)) {
          this.logger.log(`Bỏ qua social/video: ${item.url}`);
          continue;
        }
        seenUrls.add(item.url);
        collected.push({ ...item, lang });
      }

      if (collected.length < limit) {
        this.logger.log(`[${lang}] lấy được ${results.length - (results.length - collected.length)} URL hợp lệ, chuyển sang ngôn ngữ tiếp theo`);
      }
    }

    return collected;
  }

  private async fetchSerper(
    apiKey: string,
    keyword: string,
    hl: string,
    gl: string,
    num: number,
  ): Promise<Omit<SearchResult, 'lang'>[]> {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: keyword, num, hl, gl }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`Serper error [${hl}]: ${res.status} — ${err.slice(0, 200)}`);
        return [];
      }

      const data: any = await res.json();
      return (data.organic || []).map((item: any) => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet || '',
      }));
    } catch (e: any) {
      this.logger.error(`Serper search thất bại [${hl}]: ${e.message}`);
      return [];
    }
  }
}
