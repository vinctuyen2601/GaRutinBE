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
/**
 * Danh sách dùng chung cho CẢ HAI tầng — xuất ra để tầng đọc khỏi chép lại.
 * Trước 22/09/2026 tầng đọc có bản chép tay riêng, thiếu 24 mục.
 */
export const BOT_PATTERN = [
    'bot', 'crawl', 'spider', 'slurp', 'scraper',
    'facebookexternalhit', 'bingpreview', 'headless', 'phantomjs',
    'lighthouse', 'pagespeed', 'uptime', 'monitor', 'pingdom',
    'curl', 'wget', 'python-requests', 'go-http-client', 'axios', 'okhttp',
    // Nhóm KHÔNG chứa chữ "bot" nên lọt hết mẫu chung ở trên. Đo ngày
    // 16/09/2026 bên 17fishing: GoogleOther và Google-NotebookLM nằm lẫn trong
    // nhóm "khách trực tiếp", được đếm như người thật.
    'googleother', 'google-extended', 'google-notebooklm', 'adsbot',
    'mediapartners', 'feedfetcher', 'apis-google',
    'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web',
    'anthropic-ai', 'perplexitybot', 'perplexity-user', 'bytespider',
    'meta-externalagent', 'amazonbot', 'ccbot', 'dataforseo', 'ahrefs', 'semrush',
    // Thêm 22/09/2026: soi nhóm "trực tiếp" bên 17fishing thấy
    // Google-Read-Aloud được đếm như người thật — UA của nó KHÔNG chứa chữ
    // "bot" nên lọt mọi mẫu chung ở trên.
    'google-read-aloud', 'google-inspectiontool', 'storebot-google',
  ].join('|');

const BOT_RE = new RegExp(BOT_PATTERN, 'i');

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

/**
 * Nhận ra trình duyệt nằm TRONG một ứng dụng nhắn tin / mạng xã hội.
 *
 * VÌ SAO QUAN TRỌNG VỚI SHOP NÀY: đơn hàng thật chốt qua Zalo và điện thoại. Nhưng trình
 * duyệt trong ứng dụng Zalo **không gửi referrer** khi mở link, nên mọi lượt
 * khách bấm link mình gửi trong Zalo đều rơi vào nhóm "trực tiếp". Nhìn bảng
 * nguồn thì tưởng khách tự gõ tên miền vào, thực ra là khách từ Zalo.
 *
 * Cùng lý do với Facebook: bấm link trong ứng dụng Facebook hoặc Messenger
 * cũng thường mất referrer, nên con số facebook trong bảng luôn thấp hơn thật.
 *
 * User-Agent thì KHÔNG mất — nó nằm ở header HTTP chứ không phụ thuộc chính
 * sách referrer. Nên đây là cách duy nhất tách được nhóm này mà không cần đổi
 * gì ở phía người gửi link.
 *
 * Trả về null khi không nhận ra, để người gọi tự quyết định gọi là gì.
 */
export function inAppBrowser(ua?: string | null): string | null {
  if (!ua) return null;
  // Zalo đặt chuỗi "Zalo" kèm số hiệu bản dựng trong UA của webview.
  if (/\bZalo\b/i.test(ua)) return 'zalo';
  // FBAN/FBAV: ứng dụng Facebook. FB_IAB: trình duyệt nhúng. Messenger dùng
  // FBAN/Messenger nên đã nằm trong cùng nhóm.
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'facebook-app';
  if (/\bInstagram\b/i.test(ua)) return 'instagram';
  // TikTok webview đi dưới nhiều tên tuỳ thị trường và phiên bản.
  if (/BytedanceWebview|musical_ly|\bTikTok\b/i.test(ua)) return 'tiktok';
  return null;
}
