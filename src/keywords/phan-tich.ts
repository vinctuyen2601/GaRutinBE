/**
 * Ghép từ khoá với bài viết đã có, rồi kết luận nên làm gì.
 *
 * Đây là phần đáng giá nhất của cả chức năng: giá trị lớn nhất không phải là
 * bảo admin viết thêm gì, mà là NGĂN viết thứ không nên viết. Blog đang có 90
 * bài với 37 bài chưa ai đọc — một công cụ nói được "chủ đề này đã có bài rồi
 * và nó 0 người đọc, đừng viết nữa" đáng hơn một công cụ đẻ ra bài thứ 91.
 */

export type ViecNenLam =
  | 'viet-moi'
  | 'sua-tieu-de'
  | 'gop-bai'
  | 'da-tot'
  | 'bo-qua'
  | 'chua-du-lieu';

export interface BaiKhop {
  slug: string;
  title: string;
  nguoiDoc: number;
}

export interface KetQuaPhanTich {
  viec: ViecNenLam;
  lyDo: string;
  baiKhop: BaiKhop[];
}

/** Bỏ dấu và hạ chữ thường để so khớp — dữ liệu thật viết lẫn lộn hai kiểu. */
function chuanHoa(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/**
 * Hai tiêu đề có nói cùng một chuyện không.
 *
 * Đo theo Jaccard trên từ có nghĩa: chung / tổng. Ngưỡng 0.5 tức quá nửa số từ
 * là chung — đủ chặt để "Hướng Dẫn Làm Chuồng Nuôi Gà Rutin" và "Chuồng Nuôi Gà
 * Rutin, Cách Chọn Tự Làm" bị coi là trùng, nhưng không kéo theo những bài chỉ
 * tình cờ có chung một hai từ.
 */
function giongNhau(a: string, b: string): boolean {
  const ta = new Set(tachTu(a));
  const tb = new Set(tachTu(b));
  if (ta.size === 0 || tb.size === 0) return false;
  let chung = 0;
  for (const t of ta) if (tb.has(t)) chung++;
  return chung / (ta.size + tb.size - chung) >= 0.5;
}

/** Kiểm từ khoá có quá chung không — tức không còn từ nào mang thông tin. */
export function quaChung(tuKhoa: string): boolean {
  return tachTu(tuKhoa).length === 0;
}

/** Từ có mặt ở gần hết tiêu đề nên không nói lên điều gì về sự liên quan. */
const TU_VO_NGHIA = new Set([
  'ga', 'rutin', 'cho', 'va', 'cua', 'the', 'nao', 'gi', 'co', 'khong',
  'cach', 'huong', 'dan', 'nhat', 'tai', 'nha', 'la', 'bi', 'quyet',
]);

/**
 * Các cách viết khác nhau của cùng một thứ.
 *
 * Bắt buộc phải có, không phải chuyện làm cho đẹp: người tìm gõ "tphcm" liền
 * một từ, còn tiêu đề bài viết "TP HCM" tách hai từ — không gộp lại thì từ khoá
 * mang về nhiều lượt nhấp nhất của shop lại báo là "chưa có bài nào", trong khi
 * bài đó đang có 111 người đọc.
 */
const DONG_NGHIA: Record<string, string> = {
  tp: 'tphcm', hcm: 'tphcm', 'ho chi minh': 'tphcm', 'sai gon': 'tphcm',
  saigon: 'tphcm', sg: 'tphcm',
};

/*
 * CỐ Ý KHÔNG ánh xạ "long" → "chuong".
 *
 * Ở đây có bỏ dấu, nên "lông" và "lồng" cùng thành "long". Thêm ánh xạ đó thì
 * mọi bài về màu LÔNG bị ghép vào từ khoá về CHUỒNG — đã thấy thật khi thử:
 * "Gà Rutin Lông Xù" nhảy vào nhóm "chuồng nuôi gà rutin". Mất khả năng ghép
 * lồng↔chuồng vẫn nhẹ hơn nhiều so với ghép sai.
 */

function tachTu(s: string): string[] {
  let t = chuanHoa(s);
  // Gộp cụm nhiều chữ trước khi tách, vì tách xong thì "ho chi minh" mất dấu vết.
  for (const cum of ['ho chi minh', 'sai gon']) {
    t = t.split(cum).join(' tphcm ');
  }
  const tu = t
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length >= 2 && !TU_VO_NGHIA.has(x))
    .map((x) => DONG_NGHIA[x] ?? x);
  return [...new Set(tu)];
}

/**
 * Tìm bài đang nhắm cùng chủ đề với từ khoá.
 *
 * Ngưỡng đặt theo TỈ LỆ từ khoá được phủ, không phải số từ chung tuyệt đối:
 * "chuồng gà rutin" chỉ còn đúng một từ có nghĩa sau khi lọc, nên đòi hai từ
 * chung là không bao giờ khớp được từ khoá ngắn — mà từ khoá ngắn lại là loại
 * có nhiều lượt tìm nhất.
 */
export function timBaiKhop(
  tuKhoa: string,
  baiViet: { slug: string; title: string }[],
  nguoiDoc: Record<string, number>,
): BaiKhop[] {
  const tk = new Set(tachTu(tuKhoa));
  // Từ khoá chỉ toàn từ chung ("gà rutin") không ghép được với bài cụ thể nào —
  // trả về rỗng ở đây là ĐÚNG, nhưng nơi gọi phải phân biệt "không ghép được"
  // với "chưa có bài", nếu không sẽ khuyên viết mới cho một chủ đề đã có 90 bài.
  if (tk.size === 0) return [];

  return baiViet
    .map((b) => {
      const tb = new Set(tachTu(b.title));
      let chung = 0;
      for (const t of tk) if (tb.has(t)) chung++;
      return { b, tiLe: chung / tk.size, chung };
    })
    // Đòi phủ gần hết từ khoá VÀ ít nhất 2 từ chung khi từ khoá có từ 2 từ trở
    // lên. Chỉ dùng tỉ lệ thì "mua ở đâu" khớp với cả 21 bài có chữ "mua" —
    // đúng về mặt số học nhưng vô dụng để ra quyết định.
    .filter((x) => x.tiLe >= 0.75 && (tk.size < 2 || x.chung >= 2))
    .sort((a, b) => (nguoiDoc[b.b.slug] ?? 0) - (nguoiDoc[a.b.slug] ?? 0))
    .map((x) => ({
      slug: x.b.slug,
      title: x.b.title,
      nguoiDoc: nguoiDoc[x.b.slug] ?? 0,
    }));
}

/**
 * Kết luận việc nên làm cho một từ khoá.
 *
 * Thứ tự xét có chủ đích, không đảo được:
 *
 * 1. Nhiều bài cùng nhắm một từ khoá là hỏng nặng nhất — Google phải chọn một
 *    và tín hiệu bị chia đôi. Xét trước mọi thứ khác. Đây đúng là chuyện đã xảy
 *    ra với "bao lâu thì đẻ trứng": hai bài, cả hai 0 người đọc.
 * 2. Có hiển thị mà không có bài là nhu cầu đang bỏ không — việc dễ nhất.
 * 3. Có bài, có hạng, mà ít người bấm thì sửa tiêu đề rẻ hơn viết lại nhiều.
 * 4. Không có hiển thị mà đã có bài nghĩa là chủ đề không ai tìm — đừng mở
 *    rộng thêm. Đây là bài học từ 10 bài theo quận: 14 người đọc tổng cộng.
 */
export function ketLuan(
  kw: { impressions: number | null; clicks: number | null; position: string | null },
  bai: BaiKhop[],
  quaChung = false,
): KetQuaPhanTich {
  // Từ khoá chung chung như "gà rutin" không ghép được với bài nào cụ thể, và
  // cũng không nên khuyên viết bài mới — cả website đã nói về nó rồi. Việc cần
  // làm nằm ở trang chủ, không phải ở một bài viết.
  if (quaChung) {
    return {
      viec: 'sua-tieu-de',
      lyDo:
        'Từ khoá quá chung, cả website đang nhắm vào nó chứ không riêng bài nào. ' +
        'Viết thêm bài không giúp — việc cần làm là tiêu đề và mô tả của TRANG CHỦ.',
      baiKhop: [],
    };
  }
  const hienThi = kw.impressions ?? null;
  const nhap = kw.clicks ?? 0;
  const viTri = kw.position ? Number(kw.position) : null;

  // "Trùng" phải là HAI BÀI GIỐNG NHAU, không phải hai bài cùng khớp từ khoá.
  //
  // Phân biệt này quyết định: với 94 bài cùng nói về gà rutin, hầu như từ khoá
  // nào cũng khớp từ hai bài trở lên — báo "gộp bài" cho tất cả thì ra 16 dòng
  // giống hệt nhau và vô dụng. Còn "Máy Ấp Trứng" với "Trứng Gà Rutin Chế Biến"
  // cùng khớp từ khoá về trứng nhưng là hai bài khác nhau, không gộp được.
  if (bai.length > 1 && giongNhau(bai[0].title, bai[1].title)) {
    const tong = bai.reduce((s, b) => s + b.nguoiDoc, 0);
    return {
      viec: 'gop-bai',
      lyDo: `${bai.length} bài cùng nhắm từ khoá này (tổng ${tong} người đọc). Google phải chọn một, tín hiệu bị chia nhỏ — nên gộp lại thành một bài.`,
      baiKhop: bai,
    };
  }

  if (hienThi === null) {
    return {
      viec: 'chua-du-lieu',
      lyDo: bai.length
        ? 'Đã có bài nhưng chưa có số liệu Search Console — nhập số liệu để biết có ai tìm không.'
        : 'Chưa có số liệu Search Console và chưa có bài. Nhập số liệu trước khi quyết định viết.',
      baiKhop: bai,
    };
  }

  // Không phải trùng thì chỉ xét bài khớp nhất — nhiều bài cùng chủ đề rộng là
  // chuyện bình thường, không phải vấn đề cần sửa.
  const chinh = bai.slice(0, 1);

  if (bai.length === 0) {
    return hienThi > 0
      ? {
          viec: 'viet-moi',
          lyDo: `${hienThi} lượt hiển thị mà chưa có bài nào nhắm vào — nhu cầu đang bỏ không.`,
          baiKhop: [],
        }
      : {
          viec: 'bo-qua',
          lyDo: 'Không có lượt hiển thị nào và cũng chưa có bài. Chưa có bằng chứng ai tìm từ khoá này.',
          baiKhop: [],
        };
  }

  const ctr = hienThi > 0 ? nhap / hienThi : 0;

  if (hienThi === 0) {
    return {
      viec: 'bo-qua',
      lyDo: 'Đã có bài nhưng không ai tìm từ khoá này — đừng mở rộng thêm chủ đề này.',
      baiKhop: bai,
    };
  }

  // Ở trang 1 mà ít người bấm thì vấn đề nằm ở tiêu đề và mô tả, không phải thứ hạng.
  if (viTri !== null && viTri <= 10 && ctr < 0.05) {
    return {
      viec: 'sua-tieu-de',
      lyDo: `Đang ở vị trí ${viTri} nhưng chỉ ${(ctr * 100).toFixed(1)}% người bấm. Có hạng rồi — sửa tiêu đề và mô tả SEO rẻ hơn viết lại nhiều.`,
      baiKhop: bai,
    };
  }

  if (viTri !== null && viTri > 10) {
    return {
      viec: 'viet-moi',
      lyDo: `Đã có bài nhưng đứng vị trí ${viTri}, gần như không ai thấy. Cần bổ sung nội dung cho sâu hơn.`,
      baiKhop: bai,
    };
  }

  return {
    viec: 'da-tot',
    lyDo: `${nhap} lượt nhấp trên ${hienThi} lượt hiển thị (${(ctr * 100).toFixed(1)}%). Đang chạy tốt — giữ nguyên.`,
    baiKhop: bai,
  };
}
