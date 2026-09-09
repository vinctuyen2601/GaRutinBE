import { Injectable, Logger } from '@nestjs/common';

export type LoaiGoiY = 'tu-dong' | 'cau-hoi' | 'lien-quan';

@Injectable()
export class GoiYService {
  private readonly logger = new Logger(GoiYService.name);

  /**
   * Gợi ý từ Google Autocomplete.
   *
   * Đây là nguồn quan trọng nhất cho câu hỏi "mình còn THIẾU từ khoá nào":
   * Search Console chỉ thấy truy vấn mà website đã có mặt, nên từ khoá chưa
   * xếp hạng ở đâu cả thì hoàn toàn vô hình với nó. Autocomplete thì không phụ
   * thuộc website — nó là thứ Google gợi cho mọi người khi họ gõ.
   *
   * Không cần API key và không giới hạn, nên phần này chạy được kể cả khi chưa
   * kết nối Search Console.
   */
  async tuDong(tuKhoa: string): Promise<string[]> {
    const q = new URLSearchParams({
      q: tuKhoa, client: 'firefox', hl: 'vi', gl: 'vn',
      // Thiếu hai tham số này thì Google trả về mã hoá latin-1 và mọi dấu tiếng
      // Việt thành ký tự hỏng — đã gặp thật khi thử.
      ie: 'utf8', oe: 'utf8',
    });
    try {
      const res = await fetch(`https://suggestqueries.google.com/complete/search?${q}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.[1]) ? data[1].filter((x: unknown) => typeof x === 'string') : [];
    } catch (e: any) {
      // Gợi ý hỏng không được làm chết cả trang.
      this.logger.warn(`Autocomplete thất bại cho "${tuKhoa}": ${e.message}`);
      return [];
    }
  }
}
