import { Injectable, Logger } from '@nestjs/common';

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  async searchGoogle(keyword: string, limit = 3): Promise<SearchResult[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      this.logger.warn('SERPER_API_KEY chưa được cấu hình');
      return [];
    }

    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: keyword,
          num: Math.min(limit, 10),
          hl: 'vi',
          gl: 'vn',
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`Serper error: ${res.status} — ${err.slice(0, 200)}`);
        return [];
      }

      const data: any = await res.json();
      return (data.organic || [])
        .slice(0, limit)
        .map((item: any) => ({
          url: item.link,
          title: item.title,
          snippet: item.snippet || '',
        }));
    } catch (e: any) {
      this.logger.error(`Serper search thất bại: ${e.message}`);
      return [];
    }
  }
}
