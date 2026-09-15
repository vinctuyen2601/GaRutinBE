import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Post } from '../posts/entities/post.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchConsoleService } from '../keywords/search-console.service';

/**
 * Tên miền web. Repo này chưa có hằng số dùng chung như 17fishing
 * (`config/shop.ts`) — tên miền đang gõ rải rác ở bốn chỗ, và tệ hơn là qua
 * HAI biến môi trường khác nhau cho cùng một thứ: `SITE_URL` ở posts, `WEB_URL`
 * ở products và tro-ly. Ở đây theo `SITE_URL` cho khớp phần sinh sitemap.
 *
 * Gom về một mối thì nên làm, nhưng không phải trong lúc sửa một lỗi khác.
 */
const SHOP_SITE_URL = (process.env.SITE_URL || 'https://garutin.com').replace(/\/+$/, '');

/** Sự kiện để kênh thông báo đăng ký. Bật trong CMS → Cài đặt → Thông báo. */
export const SU_KIEN_CANH = 'canh.canh-bao';

/**
 * Canh sức khoẻ tài sản, chạy tự động mỗi ngày.
 *
 * VÌ SAO NẰM TRONG BACKEND chứ không phải cron ngoài máy chủ hay GitHub Actions:
 * mọi cách bên ngoài đều phải cầm một token quản trị, mà token JWT của hệ thống
 * này HẾT HẠN — đo ngày 15/09/2026 thì hai token còn 8 và 19 ngày. Cron cầm
 * token hết hạn sẽ im lặng ngừng làm việc đúng lúc không ai để ý. Chạy trong
 * backend thì dùng thẳng repository, không cần token nào.
 *
 * IM LẶNG KHI TRONG NGƯỠNG. Không có cảnh báo thì không gửi gì. Báo cáo rỗng
 * làm hỏng lòng tin nhanh hơn không báo cáo, và một kênh Telegram ngày nào cũng
 * kêu "mọi thứ ổn" sẽ bị tắt thông báo trong hai tuần.
 *
 * Những thứ canh ở đây đều là lỗi ĐÃ XẢY RA THẬT, nên chúng lặp lại được:
 *   - liên kết nội bộ trỏ vào trang đã gộp: đo ngày 15/09/2026 ra 32/260 liên
 *     kết của shop này trỏ thẳng vào trang chuyển hướng, sau đợt gộp 20 trang
 *     cửa ngõ mà không ai rà lại
 *   - Google ngừng đọc sitemap: bên 17fishing từng 3,5 tháng không ai biết, hệ
 *     quả là 13 URL ở trạng thái "Google không xác định được URL". Shop này
 *     hiện Google đọc sitemap đều, nhưng không có gì bảo đảm điều đó kéo dài
 *
 * KHÔNG canh thứ hạng ở đây. Search Console trễ 2 ngày và dao động ngày qua
 * ngày lớn hơn xu hướng thật — canh hằng ngày chỉ sinh báo động giả.
 */
@Injectable()
export class CanhService {
  private readonly logger = new Logger(CanhService.name);
  private static readonly NGUONG_NGAY_SITEMAP = 14;

  constructor(
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    private readonly thongBao: NotificationsService,
    private readonly gsc: SearchConsoleService,
  ) {}

  /**
   * 7 giờ 12 sáng — lệch khỏi mốc tròn có chủ ý. Mốc :00 là lúc mọi tác vụ
   * định kỳ trên đời cùng chạy, và cũng là lúc dịch vụ ngoài dễ nghẽn nhất.
   */
  @Cron('12 7 * * *', { name: 'canh-hang-ngay', timeZone: 'Asia/Ho_Chi_Minh' })
  async chayHangNgay(): Promise<{ soCanhBao: number; canhBao: string[] }> {
    const canhBao: string[] = [];
    for (const kiem of [this.lienKetChet, this.sitemapBoQuen]) {
      try {
        const r = await kiem.call(this);
        if (r) canhBao.push(r);
      } catch (e) {
        // Một phép kiểm hỏng không được làm câm cả bộ canh — báo luôn cái hỏng.
        canhBao.push(`Phép kiểm lỗi: ${(e as Error).message}`);
      }
    }
    if (!canhBao.length) {
      this.logger.log('Canh hằng ngày: mọi thứ trong ngưỡng');
      return { soCanhBao: 0, canhBao: [] };
    }
    // Tên miền trong tiêu đề: nếu sau này hai shop cùng đổ vào một kênh
    // Telegram thì người đọc phải biết ngay tin này của shop nào.
    const tin = [`⚠️ CANH HẰNG NGÀY — ${SHOP_SITE_URL.replace(/^https?:\/\//, '')}`, '', ...canhBao.map((c) => `• ${c}`)].join('\n');
    this.logger.warn(tin.replace(/\n/g, ' | '));
    await this.thongBao.dispatch(SU_KIEN_CANH, tin, {
      subject: 'Canh hằng ngày — có việc cần xem',
      html: `<pre>${tin}</pre>`,
    });
    return { soCanhBao: canhBao.length, canhBao };
  }

  /**
   * Liên kết nội bộ trỏ vào bài đã gộp.
   *
   * Sinh ra theo hai đường và cả hai đều âm thầm: gộp một bài thì mọi liên kết
   * đang trỏ tới nó thành liên kết chết, và hàm nối liên kết tự động có thể
   * chèn liên kết mới vào bài vừa gộp nếu quên lọc redirectTo.
   */
  private async lienKetChet(): Promise<string | null> {
    const daGop = await this.postRepo.find({
      where: { redirectTo: Not(IsNull()) },
      select: ['slug'],
    });
    if (!daGop.length) return null;
    const cheo = new Set(daGop.map((p) => p.slug));

    const song = await this.postRepo.find({
      where: { status: 'published', redirectTo: IsNull() },
      select: ['slug', 'content'],
    });
    const hong: string[] = [];
    for (const b of song) {
      for (const m of String(b.content ?? '').matchAll(/href="\/blog\/([a-z0-9-]+)"/g)) {
        // URL ĐẦY ĐỦ, không phải đường dẫn tương đối: tin này đọc trên
        // Telegram ở điện thoại, mà `/blog/abc` thì bấm không được — người
        // nhận phải tự gõ tên miền vào. Một cảnh báo không bấm được là một
        // cảnh báo bị hoãn lại tới lúc ngồi trước máy tính.
        if (cheo.has(m[1])) hong.push(`${SHOP_SITE_URL}/blog/${b.slug}\n     ↳ trỏ tới bài đã gộp: ${m[1]}`);
      }
    }
    if (!hong.length) return null;
    const them = hong.length > 5 ? `\n   … và ${hong.length - 5} liên kết nữa` : '';
    return `${hong.length} liên kết nội bộ trỏ vào trang chuyển hướng:\n   ${hong.slice(0, 5).join('\n   ')}${them}`;
  }

  /** Google có còn đọc sitemap không, và nó có báo lỗi gì không. */
  private async sitemapBoQuen(): Promise<string | null> {
    if (!this.gsc.daCauHinh()) return null;
    const ds = await this.gsc.trangThaiSitemap();
    if (!Array.isArray(ds)) return null;
    const y: string[] = [];
    for (const s of ds) {
      if (Number(s.coLoi) > 0) y.push(`sitemap có ${s.coLoi} lỗi theo Search Console`);
      if (!s.lanCuoiTaiVe) { y.push('Google chưa từng tải sitemap'); continue; }
      const ngay = Math.floor((Date.now() - new Date(s.lanCuoiTaiVe).getTime()) / 86_400_000);
      if (ngay > CanhService.NGUONG_NGAY_SITEMAP) {
        y.push(
          `Google chưa đọc sitemap ${ngay} ngày — gửi lại tại\n     ` +
            `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(SHOP_SITE_URL)}`,
        );
      }
    }
    return y.length ? y.join('\n   ') : null;
  }
}
