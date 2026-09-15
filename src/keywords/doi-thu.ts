/**
 * Đọc bảng xếp hạng Google cho một từ khoá: ai đang đứng trên mình.
 *
 * VÌ SAO CẦN: Search Console cho biết mình đứng hạng mấy, nhưng không cho biết
 * hạng đó là hạng giữa những ai. Hai tình huống cho ra cùng con số "hạng 9,5"
 * mà dẫn tới hai kế hoạch trái ngược:
 *
 *   - Chín kết quả trên là Shopee, TikTok, Facebook → đó là mặt bằng sàn và
 *     mạng xã hội. Viết thêm nội dung không kéo được hạng, vì Google đang
 *     xếp theo loại trang chứ không theo chất lượng bài. Việc đúng là bỏ từ
 *     khoá đó và dồn sang nhóm truy vấn có ý định cụ thể hơn.
 *   - Chín kết quả trên là blog và shop nhỏ → với tới được, đáng đầu tư.
 *
 * Không phân biệt được hai thứ này thì mọi đề xuất đều là đoán.
 *
 * ĐỔI MỤC ĐÍCH (15/09/2026): khoá serper.dev ban đầu mua để lấy hai khối
 * "Mọi người cũng hỏi" và "Tìm kiếm liên quan". Đo thật bốn truy vấn — hai
 * ngách, hai rộng — cả bốn đều trả về mảng rỗng, kể cả "câu cá" vốn chắc chắn
 * có khối liên quan khi tìm bằng trình duyệt. Tài liệu serper ghi hai trường
 * đó chỉ có "khi có". Nên chuyển sang dùng phần `organic`, vốn luôn đầy đủ và
 * tốn đúng một credit như cũ.
 */

/** Sàn thương mại điện tử — nội dung không cạnh tranh nổi về mặt loại trang. */
const SAN = [
  'shopee.vn', 'lazada.vn', 'tiki.vn', 'sendo.vn', 'chotot.com',
  'amazon.com', 'alibaba.com', 'aliexpress.com',
];

/** Mạng xã hội và video — cùng lý do trên. */
const MANG_XA_HOI = [
  'facebook.com', 'fb.com', 'tiktok.com', 'youtube.com', 'youtu.be',
  'instagram.com', 'threads.net', 'x.com', 'twitter.com', 'pinterest.com',
  'zalo.me', 'reddit.com', 'quora.com',
];

export type LoaiTrang = 'san' | 'mang-xa-hoi' | 'cua-minh' | 'khac';

export function tenMien(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function thuoc(host: string, ds: string[]): boolean {
  return ds.some((d) => host === d || host.endsWith(`.${d}`));
}

export function phanLoai(host: string, mienCuaMinh: string): LoaiTrang {
  if (!host) return 'khac';
  const minh = mienCuaMinh.replace(/^www\./, '').toLowerCase();
  if (host === minh || host.endsWith(`.${minh}`)) return 'cua-minh';
  if (thuoc(host, SAN)) return 'san';
  if (thuoc(host, MANG_XA_HOI)) return 'mang-xa-hoi';
  return 'khac';
}

export interface DongSerp {
  hang: number;
  tenMien: string;
  url: string;
  tieuDe: string;
  loai: LoaiTrang;
}

export interface KetQuaSerp {
  tuKhoa: string;
  ketQua: DongSerp[];
  /** Hạng của mình trong 10 kết quả đầu, null nếu không có mặt. */
  hangCuaMinh: number | null;
  /** Đếm theo loại — con số quyết định "có với tới được không". */
  soSan: number;
  soMangXaHoi: number;
  /**
   * Kết luận máy đọc được, để không phải tự diễn giải lại mỗi lần:
   * sàn + mạng xã hội chiếm quá nửa trang một thì coi là không với tới.
   */
  ketLuan: 'kho-voi-toi' | 'voi-toi-duoc';
  loi?: string;
}

export function phanTichSerp(
  tuKhoa: string,
  organic: { link?: string; title?: string; position?: number }[],
  mienCuaMinh: string,
): KetQuaSerp {
  const ketQua: DongSerp[] = organic.slice(0, 10).map((o, i) => {
    const host = tenMien(o.link ?? '');
    return {
      // Dùng vị trí trong mảng khi serper không trả `position`: mảng organic
      // vốn đã theo đúng thứ tự, nên đây là dự phòng an toàn.
      hang: o.position ?? i + 1,
      tenMien: host,
      url: o.link ?? '',
      tieuDe: o.title ?? '',
      loai: phanLoai(host, mienCuaMinh),
    };
  });

  const soSan = ketQua.filter((k) => k.loai === 'san').length;
  const soMangXaHoi = ketQua.filter((k) => k.loai === 'mang-xa-hoi').length;
  const cuaMinh = ketQua.find((k) => k.loai === 'cua-minh');

  return {
    tuKhoa,
    ketQua,
    hangCuaMinh: cuaMinh ? cuaMinh.hang : null,
    soSan,
    soMangXaHoi,
    ketLuan:
      ketQua.length > 0 && (soSan + soMangXaHoi) * 2 > ketQua.length
        ? 'kho-voi-toi'
        : 'voi-toi-duoc',
  };
}
