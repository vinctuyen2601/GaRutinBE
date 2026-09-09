import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Keyword } from './entities/keyword.entity';
import { KeywordSuggestion } from './entities/keyword-suggestion.entity';
import { Post } from '../posts/entities/post.entity';
import { TrackingService } from '../tracking/tracking.service';
import { SearchService } from '../posts/search.service';
import { SearchConsoleService } from './search-console.service';
import { GoiYService } from './goi-y.service';
import { timBaiKhop, ketLuan, quaChung, type KetQuaPhanTich } from './phan-tich';

export interface DongPhanTich extends KetQuaPhanTich {
  id: string;
  keyword: string;
  impressions: number | null;
  clicks: number | null;
  position: string | null;
  ctr: number | null;
  nguon: string;
  ghiChu: string | null;
  daBoQua: boolean;
  lyDoBoQua: string | null;
}

/**
 * Trợ lý thống kê cho từ khoá.
 *
 * Thay cho vai trò cũ "máy sinh nội dung": ghép ba nguồn số liệu — nhu cầu tìm
 * kiếm (Search Console), bài đang có (CSDL), và người đọc thật (page_visits) —
 * rồi nói cho admin biết nên làm gì với từng từ khoá.
 */
@Injectable()
export class TroLyService {
  constructor(
    @InjectRepository(Keyword)
    private readonly kwRepo: Repository<Keyword>,
    @InjectRepository(KeywordSuggestion)
    private readonly ggRepo: Repository<KeywordSuggestion>,
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    private readonly tracking: TrackingService,
    private readonly search: SearchService,
    private readonly gsc: SearchConsoleService,
    private readonly goiY: GoiYService,
  ) {}

  /** Số người đọc từng bài, tra theo slug. */
  private async nguoiDocTheoSlug(): Promise<Record<string, number>> {
    const rows = await this.tracking.getVisitTable({ path: '/blog/' });
    const map: Record<string, number> = {};
    for (const r of rows as { path: string; uniqueVisitors: number }[]) {
      const slug = r.path.split('?')[0].replace(/\/+$/, '').replace('/blog/', '');
      if (slug) map[slug] = (map[slug] ?? 0) + Number(r.uniqueVisitors ?? 0);
    }
    return map;
  }

  /**
   * Bảng chính: mỗi từ khoá kèm việc nên làm.
   *
   * Sắp xếp theo mức độ đáng làm chứ không theo bảng chữ cái: việc gộp bài và
   * viết mới phải nổi lên đầu, vì đó là chỗ mất mát đang xảy ra. Trong cùng
   * nhóm thì từ khoá nhiều lượt hiển thị hơn đứng trước.
   */
  /**
   * @param gomBoQua true để xem lại những từ khoá đã bỏ qua (và khôi phục).
   */
  async bangPhanTich(gomBoQua = false): Promise<DongPhanTich[]> {
    const [kws, posts, doc] = await Promise.all([
      this.kwRepo.find(gomBoQua ? {} : { where: { daBoQua: false } }),
      this.postRepo.find({
        select: ['id', 'slug', 'title'],
        // Bỏ bài đã gộp sang bài khác. Không lọc thì gộp xong bảng vẫn đếm
        // chúng và vẫn báo "gộp bài" — việc đã làm xong mà nút vẫn còn đó,
        // người dùng bấm lại rồi tưởng hỏng. Bài chuyển hướng cũng không còn
        // nội dung riêng nên không thể "nhắm" vào từ khoá nào nữa.
        where: { redirectTo: IsNull() },
      }),
      this.nguoiDocTheoSlug(),
    ]);

    const UU_TIEN: Record<string, number> = {
      'gop-bai': 0, 'viet-moi': 1, 'sua-tieu-de': 2,
      'chua-du-lieu': 3, 'da-tot': 4, 'bo-qua': 5,
    };

    return kws
      .map((k) => {
        const bai = timBaiKhop(k.keyword, posts, doc);
        const kq = ketLuan(k, bai, quaChung(k.keyword));
        const ctr = k.impressions ? (k.clicks ?? 0) / k.impressions : null;
        return {
          id: k.id, keyword: k.keyword,
          impressions: k.impressions, clicks: k.clicks, position: k.position,
          ctr, nguon: k.nguon, ghiChu: k.ghiChu,
          daBoQua: k.daBoQua, lyDoBoQua: k.lyDoBoQua, ...kq,
        };
      })
      .sort(
        (a, b) =>
          UU_TIEN[a.viec] - UU_TIEN[b.viec] ||
          (b.impressions ?? -1) - (a.impressions ?? -1),
      );
  }

  /**
   * Nhập số liệu Search Console.
   *
   * Từ khoá chưa có trong danh sách thì TẠO MỚI — đây mới là phần đáng giá
   * nhất: nó phát hiện nhu cầu bạn chưa biết mình đang có. Bảy từ khoá gõ tay
   * hiện tại đều là phỏng đoán; Search Console là số liệu thật.
   */
  async nhapSearchConsole(
    rows: { keyword: string; impressions: number; clicks: number; position?: number }[],
  ) {
    let them = 0, capNhat = 0;
    for (const r of rows) {
      const tuKhoa = (r.keyword ?? '').trim();
      if (!tuKhoa) continue;
      let kw = await this.kwRepo.findOne({ where: { keyword: tuKhoa } });
      if (!kw) {
        kw = this.kwRepo.create({ keyword: tuKhoa, nguon: 'search-console' });
        them++;
      } else {
        capNhat++;
      }
      kw.impressions = Number(r.impressions) || 0;
      kw.clicks = Number(r.clicks) || 0;
      kw.position = r.position != null ? String(r.position) : kw.position;
      kw.statsAt = new Date();
      await this.kwRepo.save(kw);
    }
    return { them, capNhat, tong: rows.length };
  }

  /**
   * Lấy gợi ý từ khoá từ Google.
   *
   * Dùng chính lời gọi Serper mà chức năng cào bài cũ đã dùng, nhưng lấy đúng
   * hai trường trước đây bị vứt đi: `peopleAlsoAsk` (câu hỏi THẬT người dùng gõ)
   * và `relatedSearches`. Không tốn thêm đồng nào vì vẫn là một lần gọi.
   */
  /**
   * Tìm từ khoá còn THIẾU quanh một từ gốc.
   *
   * Ba nguồn, đều là truy vấn thật của người dùng:
   *   - Autocomplete: thứ Google gợi khi người ta gõ (miễn phí, không cần key)
   *   - peopleAlsoAsk: câu hỏi thật kèm theo kết quả tìm kiếm
   *   - relatedSearches: tìm kiếm liên quan Google đề xuất
   *
   * KHÔNG lấy tiêu đề bài của đối thủ dù cùng nằm trong phản hồi Serper: tiêu
   * đề là câu văn, không phải truy vấn. Nhét chúng vào danh sách từ khoá sẽ làm
   * loãng đúng thứ mà danh sách này sinh ra để làm — quyết định viết gì tiếp.
   *
   * Lọc bỏ từ khoá ĐÃ CÓ BÀI nhắm vào: giá trị của danh sách này là chỉ ra chỗ
   * thiếu, chứ không phải liệt kê lại thứ mình đã có.
   */
  async layGoiY(tuKhoa: string) {
    const [tuDong, serper] = await Promise.all([
      this.goiY.tuDong(tuKhoa),
      this.search.layGoiYTuKhoa(tuKhoa),
    ]);

    const [posts, doc, kws, daGoiY] = await Promise.all([
      this.postRepo.find({
        select: ['id', 'slug', 'title'],
        // Bỏ bài đã gộp sang bài khác. Không lọc thì gộp xong bảng vẫn đếm
        // chúng và vẫn báo "gộp bài" — việc đã làm xong mà nút vẫn còn đó,
        // người dùng bấm lại rồi tưởng hỏng. Bài chuyển hướng cũng không còn
        // nội dung riêng nên không thể "nhắm" vào từ khoá nào nữa.
        where: { redirectTo: IsNull() },
      }),
      this.nguoiDocTheoSlug(),
      this.kwRepo.find({ select: ['keyword'] }),
      this.ggRepo.find({ select: ['keyword'] }),
    ]);
    const daCo = new Set([
      ...kws.map((k) => k.keyword.toLowerCase()),
      ...daGoiY.map((g) => g.keyword.toLowerCase()),
    ]);

    const nguon: [string[], string][] = [
      [tuDong, 'tu-dong'],
      [serper.cauHoi, 'cau-hoi'],
      [serper.lienQuan, 'lien-quan'],
    ];

    let them = 0;
    let boQuaViDaCoBai = 0;
    for (const [ds, loai] of nguon) {
      for (const g of ds) {
        const t = (g ?? '').trim();
        if (!t || daCo.has(t.toLowerCase())) continue;
        daCo.add(t.toLowerCase());
        if (timBaiKhop(t, posts, doc).length > 0) {
          boQuaViDaCoBai++;
          continue;
        }
        await this.ggRepo.save(
          this.ggRepo.create({ keyword: t, tuKhoaGoc: tuKhoa, loai }),
        );
        them++;
      }
    }
    return {
      them,
      boQuaViDaCoBai,
      tuDong: tuDong.length,
      cauHoi: serper.cauHoi.length,
      lienQuan: serper.lienQuan.length,
    };
  }

  /**
   * Quét sâu: tìm gợi ý từ MỌI từ khoá đang có trong hệ thống.
   *
   * Để admin không phải tự nghĩ ra từ gốc. Giới hạn số từ gốc mỗi lần chạy vì
   * mỗi từ là hai lời gọi mạng, và Serper có hạn mức.
   */
  async quetSau(soTuGoc = 12) {
    const kws = await this.kwRepo.find({
      order: { impressions: 'DESC' },
      take: soTuGoc,
    });
    let them = 0;
    for (const k of kws) {
      const r = await this.layGoiY(k.keyword);
      them += r.them;
    }
    return { them, soTuGoc: kws.length };
  }

  /** Kéo số liệu thẳng từ Search Console, khỏi phải dán tay. */
  async dongBoSearchConsole(soNgay = 90) {
    const rows = await this.gsc.layTruyVan(soNgay);
    const kq = await this.nhapSearchConsole(rows);
    return { ...kq, soNgay };
  }

  daCauHinhGsc(): boolean {
    return this.gsc.daCauHinh();
  }

  /**
   * Bỏ qua hoặc nhận lại một từ khoá.
   *
   * Đồng bộ Search Console KHÔNG động tới cờ này — nó chỉ cập nhật lượt hiển
   * thị, lượt nhấp và vị trí. Nhờ vậy quyết định "cái này không liên quan" của
   * admin sống sót qua mọi lần đồng bộ, đúng mục đích của việc đánh dấu.
   */
  async doiBoQua(id: string, boQua: boolean, lyDo?: string) {
    await this.kwRepo.update({ id }, {
      daBoQua: boQua,
      lyDoBoQua: boQua ? (lyDo?.trim() || null) : null,
    });
    return { ok: true };
  }

  /** Xoá hẳn — chỉ dùng cho từ khoá tự gõ, vì từ Search Console sẽ quay lại. */
  async xoaTuKhoa(id: string) {
    const kw = await this.kwRepo.findOne({ where: { id } });
    if (!kw) return { ok: false };
    if (kw.nguon === 'search-console') {
      throw new BadRequestException(
        'Từ khoá đến từ Search Console sẽ được nhập lại ở lần đồng bộ sau — hãy dùng "Bỏ qua" thay vì xoá.',
      );
    }
    await this.kwRepo.delete({ id });
    return { ok: true };
  }

  danhSachGoiY() {
    return this.ggRepo.find({ where: { daBoQua: false }, order: { createdAt: 'DESC' } });
  }

  /** Nhận một gợi ý vào danh sách làm việc chính. */
  async nhanGoiY(id: string) {
    const g = await this.ggRepo.findOne({ where: { id } });
    if (!g) return { ok: false };
    const daCo = await this.kwRepo.findOne({ where: { keyword: g.keyword } });
    if (!daCo) {
      await this.kwRepo.save(this.kwRepo.create({ keyword: g.keyword, nguon: 'goi-y' }));
    }
    await this.ggRepo.delete({ id });
    return { ok: true };
  }

  async boQuaGoiY(id: string) {
    await this.ggRepo.update({ id }, { daBoQua: true });
    return { ok: true };
  }
}
