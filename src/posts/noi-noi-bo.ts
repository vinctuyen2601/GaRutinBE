/**
 * TỰ CHÈN LIÊN KẾT NỘI BỘ vào thân bài khi lưu.
 *
 * Vì sao phải làm bằng MÃ chứ không dặn trong prompt:
 *
 * LLM không biết blog có những bài nào, nên bảo nó "thêm liên kết nội bộ" là
 * nó BỊA slug. Ngày 15/09/2026 shop vừa mất 988 hiển thị và 14 lượt khách mỗi
 * 90 ngày vì đúng hai đường dẫn bài không tồn tại — thêm một nguồn sinh slug
 * ma nữa là tự chuốc lại chính lỗi đó. Prompt chỉ CẤM bịa; việc nối để mã làm,
 * vì mã có danh sách slug thật.
 *
 * Giữ chung một bản với 17fishing, đừng để trôi dạt — tracking.service.ts hai
 * shop đã lệch nhau 1.107 dòng vì không ai giữ.
 *
 * Nền của việc này: Google giảm trọng số liên kết khuôn (khối "Đọc thêm" lặp y
 * hệt trên mọi trang), liên kết nằm giữa câu văn mới tính đủ. Shop này đã có
 * 121 liên kết ngữ cảnh do người viết đặt, khá hơn 17fishing nhiều — nhưng 68
 * trong số đó dồn vào đúng một bài trụ, và 50/69 bài không nhận liên kết nào.
 *
 * Sáu luật, mỗi luật vá một cách hỏng đã gặp thật khi chạy một lượt cho 104 bài:
 *
 *   1. Mỗi cụm MỘT bài đại diện — một cụm thường là chủ đề lõi của nhiều bài,
 *      không có luật này thì không biết trỏ đâu
 *   2. Chỉ nối lần nhắc ĐẦU TIÊN
 *   3. Tối đa 3 link mỗi bài — nhiều hơn thì bài viết thành rừng link
 *   4. Chỉ nối khi CÙNG DANH MỤC hoặc cụm đủ HẸP; bỏ luật này thì một cụm nhắc
 *      thoáng qua cũng kéo bài sang chủ đề chẳng liên quan
 *   5. Bỏ qua chỗ nằm trong <a> hoặc trong tiêu đề <h*>
 *   6. Cụm DÀI nối trước, để cụm ngắn không nuốt mất cụm dài chứa nó
 *
 * KHÔNG bỏ dấu khi so khớp: `lông` và `lồng` đều thành `long`, `chuồng` và
 * `chuông` đều thành `chuong` — cả hai cặp đều là từ hay gặp ở đây. Đã dính
 * BA LẦN ở dự án này.
 */

export type BaiDeNoi = {
  slug: string;
  title: string;
  tags?: string[] | null;
  category?: string | null;
};

const TOI_DA_MOI_BAI = 3;
const CUM_HEP = 8;
const bo = (s: string): string => (s ?? '').normalize('NFC').toLowerCase();

export function noiNoiBo(
  noiDung: string,
  baiHienTai: { slug: string; category?: string | null },
  tatCa: BaiDeNoi[],
): string {
  if (!noiDung) return noiDung;

  const tanSuatCum = new Map<string, number>();
  for (const p of tatCa) {
    for (const t of new Set(p.tags ?? [])) tanSuatCum.set(t, (tanSuatCum.get(t) ?? 0) + 1);
  }

  // Bài đại diện cho mỗi cụm: cụm nằm trong TIÊU ĐỀ. Không có thì bỏ cụm.
  const daiDien = new Map<string, BaiDeNoi>();
  for (const cum of tanSuatCum.keys()) {
    const uv = tatCa.find((p) => bo(p.title).includes(cum));
    if (uv) daiDien.set(cum, uv);
  }

  const che = noiDung
    .replace(/<a[^>]*>[\s\S]*?<\/a>/g, (m) => ' '.repeat(m.length))
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g, (m) => ' '.repeat(m.length))
    /**
     * Che luôn RUỘT CỦA MỌI THẺ. Chữ trong `alt=`, `title=`, `aria-label=`
     * không phải chữ người đọc thấy, nhưng `indexOf` bên dưới vẫn tìm ra và
     * chèn thẻ <a> vào giữa thuộc tính — làm vỡ luôn cái thẻ đó.
     *
     * Đã xảy ra thật, tìm ra 21/09/2026 khi soi ảnh hỏng. Ví dụ sống:
     *   alt="Kinh nghiệm <a href="/blog/chon-day-cau-chuan">chọn dây</a> câu…"
     * Trình duyệt đọc alt tới dấu nháy thứ hai rồi coi phần còn lại là thuộc
     * tính rác. Bốn bài của 17fishing dính, cả hai shop cùng lỗi.
     *
     * Phải đặt SAU hai phép che trên: che thẻ trước thì phần chữ nằm GIỮA
     * <a> và </a> lại lộ ra, và ta chèn được link lồng trong link.
     */
    .replace(/<[^>]*>/g, (m) => ' '.repeat(m.length));
  const cheBo = bo(che);
  // Chỉ số tìm trên chuỗi đã hạ chữ phải TRÙNG ĐỘ DÀI chuỗi gốc, nếu không
  // chèn lệch vị trí và vỡ HTML. Đã bắt được một bài như vậy khi chạy thật.
  if (cheBo.length !== noiDung.length) return noiDung;

  const daCo = new Set(
    [...noiDung.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]),
  );

  const noi: { i: number; dai: number; slug: string }[] = [];
  for (const cum of [...daiDien.keys()].sort((a, b) => b.length - a.length)) {
    if (noi.length >= TOI_DA_MOI_BAI) break;
    const dich = daiDien.get(cum)!;
    if (dich.slug === baiHienTai.slug || daCo.has(dich.slug)) continue;
    const hep = (tanSuatCum.get(cum) ?? 99) <= CUM_HEP;
    if (!hep && dich.category !== baiHienTai.category) continue;
    const i = cheBo.indexOf(cum);
    if (i < 0) continue;
    if (noi.some((n) => Math.abs(n.i - i) < 200)) continue;
    noi.push({ i, dai: cum.length, slug: dich.slug });
  }

  // Chèn từ CUỐI lên ĐẦU để chỉ số phía trước không xê dịch.
  let ra = noiDung;
  for (const n of noi.sort((a, b) => b.i - a.i)) {
    ra =
      ra.slice(0, n.i) +
      `<a href="/blog/${n.slug}">` +
      ra.slice(n.i, n.i + n.dai) +
      '</a>' +
      ra.slice(n.i + n.dai);
  }
  return ra;
}
