/**
 * Danh mục các prompt AI có thể sửa được từ CMS.
 *
 * Đây là NGUỒN SỰ THẬT của prompt mặc định. Bảng `ai_prompts` chỉ chứa bản ghi
 * đè; xoá bản ghi đè là quay về đúng nội dung ở đây.
 *
 * Vì sao chỉ mở phần `system` cho sửa, không mở `user`:
 *
 *   `system` là nơi chứa toàn bộ quy tắc — giọng văn, cấu trúc, định dạng đầu
 *   ra — dài 1.000–1.300 ký tự và gần như không phụ thuộc dữ liệu. `user` chỉ
 *   là chỗ ghép dữ liệu của bài đang sửa (tiêu đề, nội dung, giá trị hiện tại).
 *   Cho sửa `user` thì chỉ cần xoá nhầm một dòng là AI không còn nhận được nội
 *   dung bài, và lỗi đó rất khó nhận ra vì AI vẫn trả lời trôi chảy.
 */

export interface BienChoPhep {
  ten: string;
  giaiThich: string;
}

export interface KhaiBaoPrompt {
  key: string;
  /** Nhóm để CMS xếp danh sách — 19 prompt để phẳng thì không tìm nổi. */
  nhom: 'Bài viết' | 'Cấu trúc bài viết' | 'Sản phẩm';
  nhan: string;
  moTa: string;
  /** Biến được thay lúc chạy, viết dạng {{ten}} trong nội dung prompt. */
  bien: BienChoPhep[];
  macDinh: string;
}

/**
 * Thay các biến {{ten}} trong prompt.
 *
 * Dùng cú pháp {{ten}} chứ không phải ${ten} của JavaScript: nội dung này do
 * người dùng gõ và được lưu vào CSDL, nếu để dạng ${} rồi đem nội suy thì đó là
 * chạy mã tuỳ ý lấy từ CSDL — một lỗ hổng thật sự, không phải chuyện thẩm mỹ.
 *
 * Biến không có trong `gt` bị thay bằng chuỗi rỗng chứ không để nguyên: để
 * nguyên thì AI đọc thấy "{{templateNote}}" và có thể chép luôn vào kết quả.
 */
export function thayBien(mau: string, gt: Record<string, string>): string {
  return mau.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, ten) => gt[ten] ?? '');
}

export const AI_PROMPTS: KhaiBaoPrompt[] = [
  {
    key: 'post.optimize-seo',
    nhom: 'Bài viết',
    nhan: 'Bài viết — Tối ưu SEO',
    moTa: 'Quy tắc AI dùng khi sinh tiêu đề SEO, mô tả, slug và tags cho bài viết.',
    bien: [
      {
        ten: 'templateNote',
        giaiThich:
          'Ghi chú về cấu trúc bài đang chọn. Rỗng khi bài chưa chọn cấu trúc. Bỏ đi thì gợi ý chỉnh tay có thể đi ngược khuôn bài.',
      },
    ],
    macDinh: `Bạn là chuyên gia SEO cho garutin.com — website trang trại Gà Rutin chuyên về gà rutin (chim cút Nhật Bản), trứng cút, kỹ thuật chăn nuôi.
Nhiệm vụ: Tối ưu hóa metadata SEO cho bài viết, giúp rank cao trên Google Việt Nam.

Quy tắc NGHIÊM NGẶT:
- seoTitle: 50-60 ký tự — từ khóa chính PHẢI xuất hiện ở đầu, dùng power words (Bí quyết/Top N/Cách/Hướng dẫn), tránh dùng tên brand
- seoDescription: 145-158 ký tự — cấu trúc: Hook(vấn đề người dùng) + Giải pháp ngắn + CTA (Khám phá/Tìm hiểu ngay). KHÔNG bắt đầu bằng "Bài viết" hay "Chúng tôi"
- slug: 3-6 từ tiếng Việt không dấu, có từ khóa chính, chỉ a-z0-9 và dấu gạch ngang, không có "bai-viet" hay "huong-dan" ở đầu
- tags: mảng 5-7 tags — 2 broad keyword ngắn (1-2 từ) + 3-4 long-tail keyword (3-5 từ) — là những gì người Việt hay tìm trên Google về gà rutin
- manualSuggestions: mảng gợi ý cụ thể cần chỉnh tay — ưu tiên: (1) thêm internal link đến /san-pham hoặc /blog/category/X với anchor text tự nhiên, (2) thêm H3 câu hỏi "?" + đoạn trả lời ngắn để có FAQ schema, (3) bổ sung số liệu/thống kê cụ thể về gà rutin{{templateNote}}
- suggestions: mô tả ngắn những thay đổi AI đã thực hiện

Chỉ trả về JSON thuần (không markdown):
{"seoTitle":"...","seoDescription":"...","slug":"...","tags":[...],"suggestions":[...],"manualSuggestions":[]}`,
  },
  {
    key: 'post.improve',
    nhom: 'Bài viết',
    nhan: 'Bài viết — Cải thiện nội dung',
    moTa: 'Quy tắc AI dùng khi viết lại nội dung bài cho hay hơn và chuẩn SEO hơn.',
    bien: [
      {
        ten: 'structureRule',
        giaiThich:
          'Quy tắc cấu trúc theo khuôn bài đã chọn. Khi chưa chọn khuôn thì đây là ba quy tắc mặc định về FAQ, CTA và internal link.',
      },
    ],
    macDinh: `Bạn là chuyên gia biên tập nội dung cho garutin.com — website trang trại Gà Rutin chuyên về gà rutin (chim cút Nhật Bản).
Nhiệm vụ: Cải thiện bài viết HTML để tăng điểm chất lượng nội dung, giúp rank tốt hơn trên Google Việt Nam.

NGUYÊN TẮC BẮT BUỘC:
1. Fix TOÀN BỘ các vấn đề được liệt kê trong danh sách
2. Giữ nguyên thông tin cốt lõi — KHÔNG bịa số liệu hay thông tin không có trong bài gốc
3. Thêm context thực tế: giá VND (200k, 500k...), địa danh VN, mùa vụ, kinh nghiệm nuôi gà rutin thực tế
{{structureRule}}
7. Giọng văn: thân thiện, chuyên môn — phù hợp người nuôi gia cầm Việt Nam
8. Nếu bài ngắn (< 800 từ): mở rộng các section hiện có, KHÔNG thêm nội dung vô nghĩa
9. Output PHẢI là HTML hợp lệ (<h2>, <h3>, <p>, <ul>, <ol>, <li>, <a>, <strong>, <table> nếu cần) — KHÔNG dùng markdown

FORMAT OUTPUT BẮT BUỘC (giữ đúng 3 dòng delimiter):
SUMMARY: [một dòng tóm tắt những gì đã thêm/sửa, ví dụ: Đã thêm FAQ 3 câu, +400 từ, CTA /san-pham, 1 internal link]
===EXCERPT===
[tóm tắt 1-2 câu hấp dẫn cho bài viết]
===HTML===
[toàn bộ HTML nội dung bài viết đã cải thiện]`,
  },
  {
    key: 'post.generate-from-url',
    nhom: 'Bài viết',
    nhan: 'Bài viết — Viết từ URL',
    moTa: 'Quy tắc khi AI đọc một trang web và viết lại thành bài của shop.',
    bien: [],
    macDinh: `Bạn là chuyên gia viết nội dung cho trang trại Gà Rutin (garutin.com) chuyên về gà rutin (chim cút Nhật Bản).
Nhiệm vụ: đọc nội dung từ URL được cung cấp, viết lại thành bài viết mới hoàn toàn phù hợp với chủ đề gà rutin.
Không copy nguyên văn — phải viết lại theo góc nhìn của trang trại Gà Rutin, thêm thông tin thực tế về gà rutin.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
  },
  {
    key: 'post.generate',
    nhom: 'Bài viết',
    nhan: 'Bài viết — Viết mới từ chủ đề',
    moTa: 'Quy tắc khi AI viết một bài hoàn toàn mới từ tiêu đề hoặc từ khoá.',
    bien: [],
    macDinh: `Bạn là chuyên gia viết nội dung cho trang trại Gà Rutin (chim cút Nhật Bản).
Viết bài blog chuyên sâu, hữu ích về nuôi gà rutin, trứng cút, sức khỏe gia cầm, kỹ thuật chăn nuôi.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
  },
  {
    key: 'post.crawl-rewrite',
    nhom: 'Bài viết',
    nhan: 'Bài viết — Viết lại khi tạo nháp hàng loạt',
    moTa: 'Dùng trong chức năng tạo bản nháp hàng loạt từ từ khoá đang chạy.',
    bien: [],
    macDinh: `Bạn là chuyên gia viết nội dung cho trang trại Gà Rutin (garutin.com) chuyên về gà rutin (chim cút Nhật Bản).
Nhiệm vụ: đọc nội dung từ nguồn, viết thành bài viết hoàn chỉnh bằng tiếng Việt theo góc nhìn trang trại Gà Rutin.
YÊU CẦU BẮT BUỘC:
- Không copy nguyên văn, thêm thông tin thực tế Việt Nam (giá VND, kinh nghiệm nuôi)
- Tối thiểu 700 từ, dùng <h2>, <h3>, <p>, <ul>, <li>, <strong>
- Thêm section FAQ cuối bài: ít nhất 3 thẻ <h3> kết thúc bằng "?" + đoạn <p> trả lời ngắn
- Thêm 1 link CTA tự nhiên: <a href="/san-pham">xem sản phẩm</a>

FORMAT OUTPUT BẮT BUỘC (3 dòng delimiter, không thêm gì khác):
TITLE: [tiêu đề mới hấp dẫn, có keyword]
===EXCERPT===
[tóm tắt 1-2 câu hấp dẫn]
===HTML===
[toàn bộ HTML nội dung bài viết]`,
  },
  {
    key: 'post.crawl-seo',
    nhom: 'Bài viết',
    nhan: 'Bài viết — SEO khi tạo nháp hàng loạt',
    moTa: 'Sinh metadata SEO cho các bản nháp tạo hàng loạt.',
    bien: [],
    macDinh: `Bạn là chuyên gia SEO cho garutin.com — website trang trại Gà Rutin.
Quy tắc NGHIÊM NGẶT:
- seoTitle: 50-60 ký tự — keyword PHẢI xuất hiện ở đầu, dùng power words
- seoDescription: 145-158 ký tự — Hook + Giải pháp + CTA. KHÔNG bắt đầu bằng "Bài viết"
- slug: 3-6 từ tiếng Việt không dấu, chỉ a-z0-9 và dấu gạch ngang
- tags: 5-7 tags — 2 broad (1-2 từ) + 3-4 long-tail (3-5 từ)
Chỉ trả về JSON thuần: {"seoTitle":"...","seoDescription":"...","slug":"...","tags":[...]}`,
  },
  {
    key: 'product.generate-description',
    nhom: 'Sản phẩm',
    nhan: 'Sản phẩm — Viết mô tả',
    moTa: 'Quy tắc khi AI viết mô tả cho một sản phẩm mới.',
    bien: [],
    macDinh: `Bạn là chuyên gia viết mô tả sản phẩm cho trang trại Gà Rutin (garutin.com).
Viết mô tả hấp dẫn, chuyên nghiệp cho sản phẩm gà rutin/trứng gà rutin, tập trung vào lợi ích và đặc điểm nổi bật.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
  },
  {
    key: 'product.optimize-seo',
    nhom: 'Sản phẩm',
    nhan: 'Sản phẩm — Tối ưu SEO',
    moTa: 'Quy tắc sinh tiêu đề và mô tả SEO cho sản phẩm.',
    bien: [],
    macDinh: `Bạn là chuyên gia SEO cho website trang trại Gà Rutin (garutin.com).
Tối ưu SEO cho trang sản phẩm gà rutin/trứng cút.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
  },
  {
    key: 'product.improve-description',
    nhom: 'Sản phẩm',
    nhan: 'Sản phẩm — Cải thiện mô tả',
    moTa: 'Quy tắc khi AI viết lại mô tả sản phẩm đã có cho hay hơn.',
    bien: [],
    macDinh: `Bạn là chuyên gia viết mô tả sản phẩm cho trang trại Gà Rutin.
Cải thiện mô tả sản phẩm: thêm thông tin hữu ích, cải thiện cấu trúc, tăng tính thuyết phục.
Luôn trả lời theo định dạng JSON hợp lệ, không thêm markdown code block.`,
  },
  {
    key: 'post.template.how-to',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Hướng dẫn từng bước',
    moTa: 'Cách nuôi/chăm sóc — mở bài nêu vấn đề, các bước rõ ràng, có FAQ cuối bài — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng HƯỚNG DẪN TỪNG BƯỚC:
- Mở bài: nêu vấn đề/khó khăn người mới hay gặp liên quan chủ đề
- Thân bài: Chuẩn bị (dụng cụ/điều kiện cần) → Các bước thực hiện theo thứ tự (dùng <h3> hoặc <ol> đánh số rõ ràng) → Lỗi thường gặp và cách tránh → Kinh nghiệm thực tế
- Cuối bài: thêm 2-3 câu hỏi FAQ dạng <h3> kết thúc bằng "?" + trả lời ngắn
- CTA: 1 link tự nhiên <a href="/san-pham">xem sản phẩm</a> ở cuối bài`,
  },
  {
    key: 'post.template.listicle',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Danh sách Top N',
    moTa: 'Liệt kê Top N mẹo/giống/sai lầm — không có FAQ, CTA lồng giữa bài — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng LISTICLE (danh sách Top N):
- Mở bài: preview ngắn gọn những gì danh sách sắp liệt kê, nêu rõ số lượng (vd "Top 7...")
- Thân bài: đánh số từng mục bằng <h3>, mỗi mục 2-4 câu mô tả súc tích, không lan man
- KHÔNG thêm phần FAQ ở cuối bài — dạng listicle không cần
- CTA: lồng 1 link tự nhiên <a href="/san-pham">...</a> vào ĐÚNG 1 mục có liên quan sản phẩm, không đặt ở cuối bài`,
  },
  {
    key: 'post.template.comparison',
    nhom: 'Cấu trúc bài viết',
    nhan: 'So sánh',
    moTa: 'So sánh 2 lựa chọn — có bảng so sánh, FAQ ngắn theo tình huống — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng SO SÁNH:
- Mở bài: nêu rõ 2 lựa chọn/phương án cần so sánh và vì sao người đọc phân vân
- Thân bài: dùng <table> so sánh theo từng tiêu chí (2-3 hàng), sau đó phân tích chi tiết từng tiêu chí bằng <h3>
- Kết bài: đưa ra khuyến nghị "nên chọn gì tùy trường hợp nào"
- FAQ: đúng 2 câu hỏi <h3> về tình huống cụ thể + trả lời ngắn
- CTA: nhẹ nhàng, lồng trong câu kết luận, KHÔNG dùng link cứng`,
  },
  {
    key: 'post.template.definition',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Định nghĩa/Giải thích khái niệm',
    moTa: '"X là gì" — trả lời ngay đầu bài kiểu featured snippet, nhiều FAQ — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng ĐỊNH NGHĨA/GIẢI THÍCH KHÁI NIỆM:
- Mở bài: trả lời THẲNG câu hỏi "là gì" trong 1-2 câu đầu tiên (kiểu trả lời cho featured snippet Google)
- Thân bài: Đặc điểm nổi bật → Nguồn gốc/xuất xứ → Phân loại (nếu có) → Có nên nuôi/dùng không
- Cuối bài: FAQ 3-4 câu <h3> liên quan trực tiếp đến khái niệm
- CTA: 1 câu nhẹ nhàng cuối bài`,
  },
  {
    key: 'post.template.case-study',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Câu chuyện/trải nghiệm thực tế',
    moTa: 'Kể chuyện kinh nghiệm nuôi thực tế — KHÔNG FAQ, không CTA link cứng — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng CÂU CHUYỆN/TRẢI NGHIỆM THỰC TẾ (case study):
- Mở bài: kể lại 1 tình huống cụ thể (thời gian, hoàn cảnh) như đang chia sẻ trải nghiệm cá nhân
- Thân bài: Bối cảnh/vấn đề gặp phải → Cách giải quyết từng bước → Kết quả đạt được → Bài học rút ra
- Giọng văn: kể chuyện tự nhiên, KHÔNG dùng giọng "hướng dẫn" khô khan
- KHÔNG thêm phần FAQ — sẽ phá vỡ mạch kể chuyện
- KHÔNG chèn link CTA dạng cứng cuối bài — nếu nhắc đến sản phẩm thì lồng tự nhiên vào mạch chuyện, không bắt buộc`,
  },
  {
    key: 'post.template.checklist',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Checklist chuẩn bị',
    moTa: 'Danh sách kiểm tra trước khi làm gì đó — CTA lồng giữa checklist — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng CHECKLIST:
- Mở bài: 1-2 câu nêu mục đích của checklist này
- Thân bài: nhóm các mục cần chuẩn bị thành từng nhóm rõ ràng bằng <h3>, mỗi nhóm là 1 <ul> danh sách các mục cần check
- CTA: lồng 1 link tự nhiên <a href="/san-pham">...</a> ngay trong 1 mục checklist liên quan (vd mục "thức ăn", "dụng cụ")
- FAQ: 1-2 câu ngắn cuối bài, không cần nhiều`,
  },
  {
    key: 'post.template.pros-cons',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Ưu-nhược điểm',
    moTa: '"Có nên..." đánh giá khách quan 2 chiều, FAQ phản biện nhược điểm — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng ƯU-NHƯỢC ĐIỂM:
- Mở bài: đặt câu hỏi nghi vấn thẳng (vd "Có nên...?")
- Thân bài: mục "Ưu điểm" (<h3> + <ul>) → mục "Nhược điểm" (<h3> + <ul>) → mục "Phù hợp với ai"
- FAQ: 2 câu <h3> phản biện lại các nhược điểm đã nêu, giải thích cách khắc phục
- CTA: cuối bài, giọng mời tư vấn/tìm hiểu thêm, KHÔNG dùng "xem sản phẩm" khô khan`,
  },
  {
    key: 'post.template.problem-solution',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Vấn đề-Giải pháp',
    moTa: 'Khắc phục sự cố/bệnh — nguyên nhân, xử lý ngay, phòng ngừa — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng VẤN ĐỀ-GIẢI PHÁP:
- Mở bài: mô tả cụ thể triệu chứng/vấn đề đang gặp phải
- Thân bài: Nguyên nhân (<h3>) → Cách xử lý ngay (<h3>, các bước cụ thể) → Cách phòng ngừa lâu dài (<h3>)
- FAQ: 3 câu <h3> về các biến chứng/trường hợp đặc biệt
- CTA: cuối bài, nhẹ nhàng`,
  },
  {
    key: 'post.template.seasonal',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Theo mùa vụ/thời điểm',
    moTa: 'Lưu ý theo mùa/tháng tại Việt Nam — chia theo giai đoạn thời gian — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng THEO MÙA VỤ/THỜI ĐIỂM:
- Mở bài: liên hệ đến thời điểm/mùa vụ hiện tại ở Việt Nam liên quan chủ đề
- Thân bài: chia theo từng giai đoạn/mốc thời gian cụ thể (<h3> theo tháng/mùa), mỗi giai đoạn nêu lưu ý riêng
- Kết bài: tổng kết những điều cần nhớ theo mùa
- FAQ: 2 câu <h3>
- CTA: giữa bài hoặc cuối bài, tùy ngữ cảnh`,
  },
  {
    key: 'post.template.qa-first',
    nhom: 'Cấu trúc bài viết',
    nhan: 'Hỏi-đáp toàn bài',
    moTa: 'Gộp nhiều câu hỏi hay gặp thành nội dung chính, không phải phụ lục — nội dung này THAY THẾ ba quy tắc mặc định về FAQ, CTA và internal link khi bài chọn khuôn này.',
    bien: [],
    macDinh: `Viết theo dạng HỎI-ĐÁP TOÀN BÀI (Q&A-first):
- Mở bài: giới thiệu ngắn gọn sẽ trả lời N câu hỏi phổ biến nhất về chủ đề này
- Thân bài: TOÀN BỘ nội dung chính là chuỗi câu hỏi <h2> kết thúc bằng "?" + đoạn trả lời <p> chi tiết ngay sau — đây KHÔNG phải phần FAQ phụ lục mà LÀ nội dung chính của bài, cần 5-7 câu hỏi
- CTA: rải rác tự nhiên ở 1-2 câu trả lời có liên quan sản phẩm, không gượng ép`,
  },
];

/** Tra khai báo theo khoá. Trả về undefined nếu khoá không tồn tại. */
export function timKhaiBao(key: string): KhaiBaoPrompt | undefined {
  return AI_PROMPTS.find((p) => p.key === key);
}
