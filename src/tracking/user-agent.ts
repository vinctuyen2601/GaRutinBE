/**
 * Nhận diện bot và loại thiết bị từ user agent.
 *
 * Cố tình không dùng thư viện: danh sách này chỉ cần đủ tốt để thống kê của một
 * shop nhỏ không bị lệch, và một tệp 40 dòng thì đọc được, sửa được khi có con
 * bot mới quấy rầy.
 */

/**
 * Bot phổ biến ở Việt Nam cộng thêm nhóm công cụ dòng lệnh và trình duyệt
 * không giao diện. Thiếu vài con thì thống kê hơi phồng, chứ không sai lệch
 * kiểu nguy hiểm — nên ưu tiên không bắt nhầm khách thật.
 */
const BOT_RE = new RegExp(
  [
    'bot', 'crawl', 'spider', 'slurp', 'scraper',
    'facebookexternalhit', 'bingpreview', 'headless', 'phantomjs',
    'lighthouse', 'pagespeed', 'uptime', 'monitor', 'pingdom',
    'curl', 'wget', 'python-requests', 'go-http-client', 'axios', 'okhttp',
  ].join('|'),
  'i',
);

/** UA rỗng gần như luôn là kịch bản tự động, khách thật thì trình duyệt nào cũng gửi. */
export function isBotUserAgent(ua?: string | null): boolean {
  if (!ua || !ua.trim()) return true;
  return BOT_RE.test(ua);
}

/**
 * Chỉ nhận diện bot khi user agent nói rõ ràng, còn UA rỗng thì coi là người thật.
 *
 * Dùng cho log tìm kiếm. Trang danh sách sản phẩm được Next.js dựng ở phía máy
 * chủ, nên yêu cầu tìm kiếm tới backend là do server của web gọi chứ không phải
 * trình duyệt của khách — không có UA. Nếu áp dụng isBotUserAgent ở đó thì mọi
 * lượt tìm kiếm đều bị coi là bot và không có gì được ghi lại.
 */
export function isExplicitBot(ua?: string | null): boolean {
  if (!ua || !ua.trim()) return false;
  return BOT_RE.test(ua);
}

// Kiểm tra tablet trước: iPad và Android tablet đều chứa chuỗi của nhóm mobile.
const TABLET_RE = /ipad|tablet|playbook|silk|(android(?!.*mobile))/i;
const MOBILE_RE = /android|iphone|ipod|windows phone|blackberry|iemobile|opera mini|mobile/i;

export type Device = 'mobile' | 'tablet' | 'desktop';

export function deviceFromUserAgent(ua?: string | null): Device | null {
  if (!ua || !ua.trim()) return null;
  if (TABLET_RE.test(ua)) return 'tablet';
  if (MOBILE_RE.test(ua)) return 'mobile';
  return 'desktop';
}
