export interface PostTemplate {
  id: string;
  name: string;
  description: string;
  brief: string;
}

// 10 cấu trúc bài viết khác nhau — chọn thủ công trong CMS trước khi bấm
// "Cải thiện nội dung" / "Tối ưu SEO", để tránh mọi bài đều có cùng 1 khuôn
// (FAQ 3 câu + CTA cuối bài giống hệt nhau) — dấu hiệu content sản xuất hàng loạt
// mà Google Helpful Content system dễ phát hiện.
export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: 'how-to',
    name: 'Hướng dẫn từng bước',
    description: 'Cách nuôi/chăm sóc — mở bài nêu vấn đề, các bước rõ ràng, có FAQ cuối bài',
    brief: `Viết theo dạng HƯỚNG DẪN TỪNG BƯỚC:
- Mở bài: nêu vấn đề/khó khăn người mới hay gặp liên quan chủ đề
- Thân bài: Chuẩn bị (dụng cụ/điều kiện cần) → Các bước thực hiện theo thứ tự (dùng <h3> hoặc <ol> đánh số rõ ràng) → Lỗi thường gặp và cách tránh → Kinh nghiệm thực tế
- Cuối bài: thêm 2-3 câu hỏi FAQ dạng <h3> kết thúc bằng "?" + trả lời ngắn
- CTA: 1 link tự nhiên <a href="/san-pham">xem sản phẩm</a> ở cuối bài`,
  },
  {
    id: 'listicle',
    name: 'Danh sách Top N',
    description: 'Liệt kê Top N mẹo/giống/sai lầm — không có FAQ, CTA lồng giữa bài',
    brief: `Viết theo dạng LISTICLE (danh sách Top N):
- Mở bài: preview ngắn gọn những gì danh sách sắp liệt kê, nêu rõ số lượng (vd "Top 7...")
- Thân bài: đánh số từng mục bằng <h3>, mỗi mục 2-4 câu mô tả súc tích, không lan man
- KHÔNG thêm phần FAQ ở cuối bài — dạng listicle không cần
- CTA: lồng 1 link tự nhiên <a href="/san-pham">...</a> vào ĐÚNG 1 mục có liên quan sản phẩm, không đặt ở cuối bài`,
  },
  {
    id: 'comparison',
    name: 'So sánh',
    description: 'So sánh 2 lựa chọn — có bảng so sánh, FAQ ngắn theo tình huống',
    brief: `Viết theo dạng SO SÁNH:
- Mở bài: nêu rõ 2 lựa chọn/phương án cần so sánh và vì sao người đọc phân vân
- Thân bài: dùng <table> so sánh theo từng tiêu chí (2-3 hàng), sau đó phân tích chi tiết từng tiêu chí bằng <h3>
- Kết bài: đưa ra khuyến nghị "nên chọn gì tùy trường hợp nào"
- FAQ: đúng 2 câu hỏi <h3> về tình huống cụ thể + trả lời ngắn
- CTA: nhẹ nhàng, lồng trong câu kết luận, KHÔNG dùng link cứng`,
  },
  {
    id: 'definition',
    name: 'Định nghĩa/Giải thích khái niệm',
    description: '"X là gì" — trả lời ngay đầu bài kiểu featured snippet, nhiều FAQ',
    brief: `Viết theo dạng ĐỊNH NGHĨA/GIẢI THÍCH KHÁI NIỆM:
- Mở bài: trả lời THẲNG câu hỏi "là gì" trong 1-2 câu đầu tiên (kiểu trả lời cho featured snippet Google)
- Thân bài: Đặc điểm nổi bật → Nguồn gốc/xuất xứ → Phân loại (nếu có) → Có nên nuôi/dùng không
- Cuối bài: FAQ 3-4 câu <h3> liên quan trực tiếp đến khái niệm
- CTA: 1 câu nhẹ nhàng cuối bài`,
  },
  {
    id: 'case-study',
    name: 'Câu chuyện/trải nghiệm thực tế',
    description: 'Kể chuyện kinh nghiệm nuôi thực tế — KHÔNG FAQ, không CTA link cứng',
    brief: `Viết theo dạng CÂU CHUYỆN/TRẢI NGHIỆM THỰC TẾ (case study):
- Mở bài: kể lại 1 tình huống cụ thể (thời gian, hoàn cảnh) như đang chia sẻ trải nghiệm cá nhân
- Thân bài: Bối cảnh/vấn đề gặp phải → Cách giải quyết từng bước → Kết quả đạt được → Bài học rút ra
- Giọng văn: kể chuyện tự nhiên, KHÔNG dùng giọng "hướng dẫn" khô khan
- KHÔNG thêm phần FAQ — sẽ phá vỡ mạch kể chuyện
- KHÔNG chèn link CTA dạng cứng cuối bài — nếu nhắc đến sản phẩm thì lồng tự nhiên vào mạch chuyện, không bắt buộc`,
  },
  {
    id: 'checklist',
    name: 'Checklist chuẩn bị',
    description: 'Danh sách kiểm tra trước khi làm gì đó — CTA lồng giữa checklist',
    brief: `Viết theo dạng CHECKLIST:
- Mở bài: 1-2 câu nêu mục đích của checklist này
- Thân bài: nhóm các mục cần chuẩn bị thành từng nhóm rõ ràng bằng <h3>, mỗi nhóm là 1 <ul> danh sách các mục cần check
- CTA: lồng 1 link tự nhiên <a href="/san-pham">...</a> ngay trong 1 mục checklist liên quan (vd mục "thức ăn", "dụng cụ")
- FAQ: 1-2 câu ngắn cuối bài, không cần nhiều`,
  },
  {
    id: 'pros-cons',
    name: 'Ưu-nhược điểm',
    description: '"Có nên..." đánh giá khách quan 2 chiều, FAQ phản biện nhược điểm',
    brief: `Viết theo dạng ƯU-NHƯỢC ĐIỂM:
- Mở bài: đặt câu hỏi nghi vấn thẳng (vd "Có nên...?")
- Thân bài: mục "Ưu điểm" (<h3> + <ul>) → mục "Nhược điểm" (<h3> + <ul>) → mục "Phù hợp với ai"
- FAQ: 2 câu <h3> phản biện lại các nhược điểm đã nêu, giải thích cách khắc phục
- CTA: cuối bài, giọng mời tư vấn/tìm hiểu thêm, KHÔNG dùng "xem sản phẩm" khô khan`,
  },
  {
    id: 'problem-solution',
    name: 'Vấn đề-Giải pháp',
    description: 'Khắc phục sự cố/bệnh — nguyên nhân, xử lý ngay, phòng ngừa',
    brief: `Viết theo dạng VẤN ĐỀ-GIẢI PHÁP:
- Mở bài: mô tả cụ thể triệu chứng/vấn đề đang gặp phải
- Thân bài: Nguyên nhân (<h3>) → Cách xử lý ngay (<h3>, các bước cụ thể) → Cách phòng ngừa lâu dài (<h3>)
- FAQ: 3 câu <h3> về các biến chứng/trường hợp đặc biệt
- CTA: cuối bài, nhẹ nhàng`,
  },
  {
    id: 'seasonal',
    name: 'Theo mùa vụ/thời điểm',
    description: 'Lưu ý theo mùa/tháng tại Việt Nam — chia theo giai đoạn thời gian',
    brief: `Viết theo dạng THEO MÙA VỤ/THỜI ĐIỂM:
- Mở bài: liên hệ đến thời điểm/mùa vụ hiện tại ở Việt Nam liên quan chủ đề
- Thân bài: chia theo từng giai đoạn/mốc thời gian cụ thể (<h3> theo tháng/mùa), mỗi giai đoạn nêu lưu ý riêng
- Kết bài: tổng kết những điều cần nhớ theo mùa
- FAQ: 2 câu <h3>
- CTA: giữa bài hoặc cuối bài, tùy ngữ cảnh`,
  },
  {
    id: 'qa-first',
    name: 'Hỏi-đáp toàn bài',
    description: 'Gộp nhiều câu hỏi hay gặp thành nội dung chính, không phải phụ lục',
    brief: `Viết theo dạng HỎI-ĐÁP TOÀN BÀI (Q&A-first):
- Mở bài: giới thiệu ngắn gọn sẽ trả lời N câu hỏi phổ biến nhất về chủ đề này
- Thân bài: TOÀN BỘ nội dung chính là chuỗi câu hỏi <h2> kết thúc bằng "?" + đoạn trả lời <p> chi tiết ngay sau — đây KHÔNG phải phần FAQ phụ lục mà LÀ nội dung chính của bài, cần 5-7 câu hỏi
- CTA: rải rác tự nhiên ở 1-2 câu trả lời có liên quan sản phẩm, không gượng ép`,
  },
];

export function getPostTemplate(id?: string): PostTemplate | undefined {
  return id ? POST_TEMPLATES.find((t) => t.id === id) : undefined;
}
