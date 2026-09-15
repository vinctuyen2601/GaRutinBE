/**
 * VÙNG TRẮNG — từ khoá có người tìm mà mình chưa đặt chân tới.
 *
 * Vì sao cần: Search Console là GƯƠNG CHIẾU HẬU. Nó chỉ thống kê truy vấn mà
 * website ĐÃ xuất hiện, nên từ khoá chưa xếp hạng ở đâu cả thì vĩnh viễn vô
 * hình với nó. Đo 15/09/2026: tìm "đồng nai" trong 220 từ khoá Search Console
 * của GaRutin ra 0 hiển thị — suýt kết luận "không ai tìm", trong khi Google
 * Autocomplete trả về ngay "gà rutin đồng nai", "mua gà rutin ở bình dương",
 * "gà rutin vũng tàu".
 *
 * Autocomplete là nguồn đúng cho việc này: nó không phụ thuộc website mình, và
 * Google chỉ gợi những cụm CÓ NGƯỜI GÕ THẬT. Không có số lượt tìm chính xác —
 * muốn số đó phải mua công cụ — nhưng "có trong Autocomplete" đã đủ để phân
 * biệt cụm thật với cụm mình tự nghĩ ra.
 *
 * Tệp này thuần, không đụng cơ sở dữ liệu, để kiểm được bằng tay.
 */

/** Ghép chữ cái vào sau cụm gốc — mẹo đào Autocomplete cho ra nhiều nhất. */
const CHU_CAI = 'abcdđeghiklmnopqrstuvxy'.split('');

/**
 * Bổ ngữ theo cách người Việt gõ khi tìm mua và tìm hiểu.
 *
 * Xếp trước/sau riêng: "giá gà rutin" và "gà rutin giá bao nhiêu" là hai truy
 * vấn khác nhau, Autocomplete trả về hai tập khác nhau.
 */
export const BO_NGU_TRUOC = [
  'mua', 'bán', 'giá', 'cách', 'kỹ thuật', 'tại sao', 'có nên', 'review', 'địa chỉ', 'trại',
];
export const BO_NGU_SAU = [
  'giá bao nhiêu', 'ở đâu', 'có tốt không', 'là gì', 'như thế nào', 'loại nào tốt',
  'cho người mới', 'tphcm', 'hà nội', 'giao hàng', 'con', 'giống',
];

/**
 * Sinh danh sách cụm để hỏi Autocomplete.
 *
 * Có giới hạn `toiDa` vì mỗi cụm là một lệnh gọi mạng: 5 cụm gốc × (1 + 10 +
 * 12 + 23 chữ cái) = 230 lệnh. Autocomplete miễn phí nhưng gọi dồn dập thì
 * Google chặn tạm, nên phải cắt và chạy nhiều đợt.
 */
export function sinhCumHoi(cumGoc: string[], toiDa = 200): string[] {
  const ra: string[] = [];
  for (const goc of cumGoc) {
    const g = goc.trim().toLowerCase();
    if (!g) continue;
    ra.push(g);
    for (const b of BO_NGU_TRUOC) ra.push(`${b} ${g}`);
    for (const b of BO_NGU_SAU) ra.push(`${g} ${b}`);
    for (const c of CHU_CAI) ra.push(`${g} ${c}`);
  }
  return [...new Set(ra)].slice(0, toiDa);
}

const bo = (s: string) => (s ?? '').normalize('NFC').toLowerCase().trim();

/**
 * Có phải truy vấn của người đang định MUA không.
 *
 * KHÔNG dùng `\b`. Ranh giới từ của JavaScript chỉ tính [A-Za-z0-9_], nên chữ
 * có dấu không được coi là ký tự từ: `giá\b` và `\bở đâu` KHÔNG BAO GIỜ khớp.
 * Bộ kiểm bắt được — "mua gà rutin" đạt (toàn chữ ASCII) còn "giá gà rutin" và
 * "gà rutin ở đâu" trượt. Dùng lookaround theo \p{L} với cờ u mới đúng.
 */
const TU_MUA = ['mua', 'bán', 'giá', 'ở đâu', 'địa chỉ', 'shop', 'trại', 'cửa hàng', 'bao nhiêu tiền', 'giao hàng', 'ship'];
export function laThuongMai(kw: string): boolean {
  const k = bo(kw);
  return TU_MUA.some((t) => new RegExp(`(?<!\\p{L})${t}(?!\\p{L})`, 'iu').test(k));
}

export type XepLoai = 'da-xep-hang' | 'co-bai-chua-hang' | 'vung-trang';

export type DongVungTrang = {
  keyword: string;
  loai: XepLoai;
  thuongMai: boolean;
  /** Bao nhiêu gợi ý khác cùng cụm lõi — thay cho số lượt tìm mà ta không có. */
  coCum: number;
  /** Bài đang nhắm cụm này, nếu có. */
  baiGan: string | null;
  diem: number;
};

/**
 * Xếp loại từng gợi ý.
 *
 * @param goiY      cụm lấy từ Autocomplete
 * @param daXepHang từ khoá Search Console ĐÃ có hiển thị
 * @param baiViet   bài đang sống (đã bỏ bài gộp), dạng {slug, title}
 */
export function xepLoaiVungTrang(
  goiY: string[],
  daXepHang: string[],
  baiViet: { slug: string; title: string }[],
): DongVungTrang[] {
  const hang = new Set(daXepHang.map(bo));
  const tuBai = baiViet.map((b) => ({ ...b, t: bo(b.title) }));

  // Cụm lõi = hai từ dài nhất của truy vấn, dùng để gom chùm. Không bỏ dấu:
  // `lông` và `lồng` đều thành `long`, mà cả hai đều là từ hay gặp ở đây.
  const loi = (k: string) =>
    bo(k).split(/\s+/).filter((w) => w.length > 2).sort((a, b) => b.length - a.length).slice(0, 2).sort().join(' ');

  const demCum = new Map<string, number>();
  for (const k of goiY) demCum.set(loi(k), (demCum.get(loi(k)) ?? 0) + 1);

  /*
   * Từ LÕI của truy vấn: bỏ bổ ngữ và từ quá ngắn.
   *
   * Bản đầu đòi tiêu đề chứa NGUYÊN CỤM truy vấn, và nó báo 227/228 là vùng
   * trắng cho một site 94 bài — con số vô lý. Ví dụ thật: "giá trứng gà rutin"
   * bị xếp vùng trắng trong khi shop có 11 bài về trứng, chỉ vì không tiêu đề
   * nào chứa đúng chuỗi "giá trứng gà rutin".
   *
   * Nay khớp theo TẬP TỪ LÕI. Vẫn không bỏ dấu — `lồng` với `lông` phải khác
   * nhau.
   */
  const BO_NGU = new Set([
    'giá', 'mua', 'bán', 'đâu', 'bao', 'nhiêu', 'tiền', 'cách', 'các', 'một',
    'quả', 'con', 'của', 'cho', 'với', 'khi', 'nào', 'sao', 'thế', 'như',
    'tốt', 'không', 'nên', 'hôm', 'nay', 'địa', 'chỉ', 'thu', 'trị',
  ]);
  const tuLoi = (k: string) =>
    bo(k).split(/\s+/).filter((w) => w.length > 2 && !BO_NGU.has(w));

  return goiY.map((keyword) => {
    const k = bo(keyword);
    const loiTu = tuLoi(keyword);
    // Coi là ĐÃ CÓ BÀI khi tiêu đề chứa từ 80% số từ lõi trở lên. Đòi 100% thì
    // "ấp trứng gà rutin mùa đông" trượt khỏi bài "Nuôi gà rutin mùa đông".
    const bai =
      tuBai.find((b) => b.t.includes(k)) ??
      (loiTu.length
        ? tuBai.find((b) => loiTu.filter((w) => b.t.includes(w)).length / loiTu.length >= 0.8) ?? null
        : null);
    const loai: XepLoai = hang.has(k) ? 'da-xep-hang' : bai ? 'co-bai-chua-hang' : 'vung-trang';
    const thuongMai = laThuongMai(keyword);
    const coCum = demCum.get(loi(keyword)) ?? 1;

    /*
     * Điểm ưu tiên. Không có số lượt tìm nên dùng ba tín hiệu thay thế:
     *   - VÙNG TRẮNG đáng hơn "có bài chưa hạng": chưa có gì thì viết mới;
     *     có bài rồi mà chưa lên thì là việc sửa, thường rẻ hơn nhưng cũng
     *     ít dư địa hơn.
     *   - THƯƠNG MẠI đáng gấp đôi: đo trên GaRutin, nhóm mua/giá/ở đâu có
     *     CTR 7,4% còn nhóm tìm hiểu chỉ 1,3%.
     *   - CHÙM LỚN đáng hơn cụm lẻ: nhiều biến thể cùng lõi là dấu hiệu chủ
     *     đề có nhu cầu rộng, thay cho con số lượt tìm ta không mua.
     */
    const diem =
      (loai === 'vung-trang' ? 3 : loai === 'co-bai-chua-hang' ? 1 : 0) +
      (thuongMai ? 4 : 0) +
      Math.min(coCum, 6);

    return { keyword, loai, thuongMai, coCum, baiGan: bai?.slug ?? null, diem };
  }).sort((a, b) => b.diem - a.diem || a.keyword.localeCompare(b.keyword));
}
