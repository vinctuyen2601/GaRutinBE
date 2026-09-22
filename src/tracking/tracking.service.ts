import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PageVisit, Platform } from './entities/page-visit.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { BOT_PATTERN } from './user-agent';

const PLATFORMS: Platform[] = ['facebook', 'youtube', 'tiktok', 'zalo', 'web', 'other'];

/**
 * Lấy phần tên miền của referrer.
 *
 * Bọc try/catch vì giá trị này do trình duyệt khách gửi lên: một chuỗi không
 * phải URL sẽ làm `new URL()` ném lỗi và hỏng cả lượt ghi nhận, chỉ vì một
 * trường phụ dùng để làm báo cáo.
 */
/**
 * Tên miền gốc của shop, không kèm www. Lấy từ cùng biến môi trường mà phần
 * sinh sitemap dùng, nên đổi tên miền là chỗ này đổi theo.
 */
const MIEN_NHA = (process.env.SITE_URL || 'https://garutin.com')
  .replace(/^https?:\/\//, '')
  .replace(/^www\./, '')
  .replace(/\/.*$/, '')
  .toLowerCase();

/**
 * Referrer này có phải của chính mình không — kể cả tên miền con.
 *
 * VÌ SAO CẦN: ngày 15/09/2026 bảng Nguồn truy cập bên 17fishing hiện
 * `admin.<tên miền>` với 8 lượt xem như thể đó là một nguồn khách. Thực ra là
 * chủ shop bấm xem trước từ CMS — trình duyệt gửi referrer là trang admin.
 * Shop này dùng cùng kiểu tên miền con nên dính y hệt.
 *
 * Hai cái hại: bảng nguồn bị pha loãng bằng lượt của chính mình, và một lượt
 * đáng lẽ là "trực tiếp" bị gán nhầm nguồn nên con số đó cũng sai theo.
 *
 * So bằng hậu tố CÓ DẤU CHẤM, không dùng endsWith trần:
 * `endsWith('garutin.com')` khớp luôn cả `giagarutin.com` của người khác.
 */
function laNhaMinh(host: string | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return h === MIEN_NHA || h.endsWith(`.${MIEN_NHA}`);
}

/**
 * Lấy host từ URL, bỏ www. Trả null nếu rỗng, không hợp lệ, hoặc là tên miền
 * của chính mình — null rơi xuống 'trực tiếp' ở biểu thức nguồn.
 */
function hostCua(url?: string): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.replace(/^www\./, '').slice(0, 200);
    return laNhaMinh(h) ? null : h;
  } catch {
    return null;
  }
}

/**
 * `referrer_host` đã lọc bỏ tên miền của chính mình, dùng trong MỌI truy vấn
 * phân loại nguồn.
 *
 * Phải gom một chỗ vì lỗi ngày 15/09/2026 nằm ở HAI cột chứ không phải một:
 * sửa cột "nguồn" mà quên cột "loại kênh" thì lượt truy cập từ CMS biến mất
 * khỏi bảng nguồn nhưng vẫn được đếm là "giới thiệu" ở bảng kênh — hai bảng
 * nói hai chuyện khác nhau về cùng một lượt xem.
 */
const REF_SACH = `NULLIF(CASE
  WHEN v.referrer_host = '${MIEN_NHA}' OR v.referrer_host LIKE '%.${MIEN_NHA}'
  THEN '' ELSE v.referrer_host
END, '')`;

/**
 * Điều kiện "một lượt xem thật".
 *
 * Từ khi có phễu mua hàng, bảng page_visits chứa cả add_to_cart và
 * begin_checkout. Đếm tất tần tật thì mỗi lần khách bấm thêm giỏ lại thành một
 * "lượt truy cập" của trang sản phẩm, và tổng lượt truy cập phồng lên theo số
 * người mua — càng bán được nhiều thì số liệu càng sai.
 *
 * Bảng nguồn và bảng phễu đã lọc như vậy từ đầu; ba thống kê dưới đây thì
 * chưa, nên hai bên nói hai con số khác nhau về cùng một ngày.
 */
/**
 * Mẫu bot dùng Ở TẦNG ĐỌC, ngoài cờ `is_bot` đã lưu lúc ghi.
 *
 * Cần cả hai vì `is_bot` được tính MỘT LẦN lúc ghi, bằng danh sách bot của thời
 * điểm đó. Thêm bot mới vào danh sách chỉ có tác dụng từ đó trở đi — hàng nghìn
 * lượt cũ vẫn mang cờ false vĩnh viễn.
 *
 * Giữ ngắn và chỉ gồm thứ chắc chắn là máy: lọc nhầm khách thật ở tầng đọc thì
 * không có cách nào phát hiện, vì lượt đó biến mất khỏi mọi báo cáo.
 */
/**
 * Lọc bot lúc ĐỌC. Lấy thẳng danh sách từ `user-agent.ts` thay vì chép lại.
 *
 * Bản chép tay cũ chỉ có 18 mục trong khi `BOT_RE` lúc GHI có 42 — thiếu 24
 * mục gồm curl, wget, lighthouse, gptbot, claudebot, chatgpt-user,
 * perplexitybot, facebookexternalhit.
 *
 * Hai danh sách đều cần: cờ `is_bot` chỉ đúng với dòng ghi SAU khi một tên
 * được thêm vào, còn bộ lọc lúc đọc mới chữa được dòng CŨ — mà bản lúc đọc
 * thiếu tên thì dòng cũ không có gì đỡ.
 *
 * Tìm ra 22/09/2026 khi soi nhóm "trực tiếp" của 17fishing. Bên đó đã gộp
 * cùng ngày; bên này lúc ấy còn nguyên. Đúng họ với bẫy whitelist EVENTS.
 */
const BOT_DOC = `(${BOT_PATTERN})`;

const KHONG_BOT = `(v.user_agent IS NULL OR v.user_agent !~* '${BOT_DOC}')`;

/**
 * Nguồn THÔ của một lượt: utm_source, rồi referrer đã bỏ tên miền nhà, rồi
 * User-Agent của trình duyệt trong ứng dụng, cuối cùng mới là 'trực tiếp'.
 *
 * Tách thành hằng ngày 22/09/2026. Trước đó nó nằm nội dòng trong
 * `getSourceTable`, nên `soiTrucTiep` phải chép lại — hai bản chép tay thì
 * sớm muộn cũng lệch, đúng kiểu đã dính với danh sách bot.
 */
const NGUON_THO = `COALESCE(NULLIF(v.utm_source, ''),
       -- Bỏ referrer của chính mình NGAY Ở TẦNG ĐỌC: bản ghi
       -- cũ đã lỡ lưu admin.<tên miền> vẫn nằm đó, sửa tầng
       -- ghi không làm chúng biến mất.
       ${REF_SACH},
       -- Trước khi kết luận "trực tiếp", đọc User-Agent.
       -- Trình duyệt trong ứng dụng Zalo KHÔNG gửi referrer,
       -- nên khách bấm link mình gửi qua Zalo đều rơi vào nhóm
       -- trực tiếp. User-Agent thì không mất vì nó ở header
       -- HTTP — tách được cả dữ liệu cũ, không cần thu lại.
       -- Trả về ĐÚNG tên nền tảng, không hậu tố "(trong app)":
       -- lớp gom nhóm bên dưới quy mọi thứ chứa 'zalo' về
       -- 'zalo' nên hậu tố sẽ bị nuốt. Và gom vậy đúng với câu
       -- hỏi kinh doanh — cần biết khách đến từ Zalo bao nhiêu,
       -- không cần tách Zalo-có-UTM với Zalo-trong-ứng-dụng.
       CASE
         WHEN v.user_agent ~* '\\mZalo\\M'                           THEN 'zalo'
         WHEN v.user_agent ~* '(FBAN|FBAV|FB_IAB|FBIOS)'             THEN 'facebook'
         WHEN v.user_agent ~* '\\mInstagram\\M'                      THEN 'instagram'
         WHEN v.user_agent ~* '(BytedanceWebview|musical_ly|TikTok)'  THEN 'tiktok'
       END,
       'trực tiếp')`;

/**
 * Gom các tên miền của cùng một nền tảng về MỘT tên.
 *
 * Chú thích trong SQL của `getSourceTable` từ lâu đã viết "lớp gom nhóm bên
 * dưới quy mọi thứ chứa 'zalo' về 'zalo'" — nhưng lớp đó chưa bao giờ tồn tại
 * ở repo này. 17fishing có (`SOURCE_EXPR`), GaRutin thì không, và đó là một
 * trong những chỗ hai repo đã trôi dạt.
 *
 * Hậu quả đo được ngày 22/09/2026: bảng nguồn 90 ngày hiện `google.com` 132
 * lượt, `google` 9, `google.com.vn` 5 thành BA dòng riêng — Google thật là
 * 146. `tiktok.com` và `tiktok` cũng tách đôi, `facebook` và `m.facebook.com`
 * cũng vậy. Không dòng nào đủ lớn để thấy một nguồn thật sự mang về bao nhiêu.
 *
 * 'trực tiếp' rơi xuống nhánh ELSE nên giữ nguyên tên, không cần liệt kê.
 */
const NGUON = `(CASE
  WHEN __SRC__ ILIKE '%facebook%' OR __SRC__ IN ('m.me', 'l.messenger.com', 'fb.com') THEN 'facebook'
  WHEN __SRC__ ILIKE '%google%'   THEN 'google'
  WHEN __SRC__ ILIKE '%tiktok%'   THEN 'tiktok'
  WHEN __SRC__ ILIKE '%youtu%'    THEN 'youtube'
  WHEN __SRC__ ILIKE '%zalo%'     THEN 'zalo'
  WHEN __SRC__ ILIKE '%instagram%' THEN 'instagram'
  WHEN __SRC__ ILIKE '%shopee%'   THEN 'shopee'
  WHEN __SRC__ ILIKE '%lazada%'   THEN 'lazada'
  WHEN __SRC__ ILIKE '%coccoc%'   THEN 'coc coc'
  WHEN __SRC__ ILIKE '%bing%'     THEN 'bing'
  WHEN __SRC__ ILIKE '%yahoo%'    THEN 'yahoo'
  WHEN __SRC__ ILIKE '%chatgpt%' OR __SRC__ ILIKE '%openai%' THEN 'chatgpt'
  ELSE __SRC__
END)`.replace(/__SRC__/g, NGUON_THO);

const LUOT_XEM_THAT = `v.event = 'view' AND v.is_bot = false AND ${KHONG_BOT}`;

const dateStart = (d: string) => d + 'T00:00:00+07:00';
const dateEnd   = (d: string) => d + 'T23:59:59+07:00';

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(PageVisit)
    private readonly visitRepo: Repository<PageVisit>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async track(dto: {
    platform: string;
    path: string;
    ip?: string;
    userAgent?: string;
    event?: string;
    visitorId?: string;
    isBot?: boolean;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
  }): Promise<void> {
    const platform = (PLATFORMS.includes(dto.platform as Platform) ? dto.platform : 'other') as Platform;
    // Chỉ nhận đúng các sự kiện đã biết. Giá trị lạ do khách tự gửi mà lọt vào
    // thì bảng phễu sinh ra những dòng không ai hiểu, và lượt xem bị mất khỏi
    // thống kê cũ vì không còn là 'view'.
    //
    // zalo_click và phone_click phải nằm trong danh sách: web bắn hai sự kiện
    // này từ 18/09/2026, mà danh sách khi đó chỉ có bốn giá trị nên chúng bị
    // quy về 'view' — mỗi cú bấm Zalo thành một lượt xem trang giả, còn phễu
    // thì không bao giờ thấy chúng. Sai lặng lẽ, không lỗi, không cảnh báo.
    const event = ['view', 'add_to_cart', 'begin_checkout', 'purchase', 'zalo_click', 'phone_click']
      .includes(dto.event ?? '') ? (dto.event as string) : 'view';
    await this.visitRepo.save(this.visitRepo.create({
      platform,
      path: dto.path,
      ip: dto.ip || null,
      userAgent: dto.userAgent || null,
      event,
      visitorId: dto.visitorId?.slice(0, 64) || null,
      isBot: dto.isBot ?? false,
      referrer: dto.referrer?.slice(0, 2000) || null,
      referrerHost: hostCua(dto.referrer),
      // Cắt 200 ký tự: giá trị utm do người ngoài đặt trong URL nên không tin
      // được độ dài, mà cột là varchar — chuỗi quá dài làm hỏng cả lượt ghi.
      utmSource: dto.utmSource?.slice(0, 200) || null,
      utmMedium: dto.utmMedium?.slice(0, 200) || null,
      utmCampaign: dto.utmCampaign?.slice(0, 200) || null,
      utmContent: dto.utmContent?.slice(0, 200) || null,
    }));
  }

  /**
   * Bảng nguồn truy cập: gom theo utm_source + utm_campaign, kèm số đơn.
   *
   * Đây là nửa còn lại của công cụ tạo link quảng cáo — tạo được link mà không
   * xem được kết quả thì link chỉ để đó.
   *
   * Lượt truy cập KHÔNG có utm được gom thành hai nhóm rõ ràng thay vì bỏ đi:
   * có referrer_host thì tính là nguồn giới thiệu (Google, Facebook tự nhiên),
   * không có gì thì là truy cập trực tiếp. Bỏ chúng đi sẽ khiến tổng trong bảng
   * không khớp với tổng lượt truy cập và người đọc sẽ nghi ngờ toàn bộ số liệu.
   *
   * Đơn hàng gom theo NGÀY chứ không truy ngược từng đơn về lượt xem: GaRutin
   * chưa lưu nguồn vào đơn, nên cột đơn ở đây là tổng đơn trong cùng khoảng
   * thời gian, dùng để đối chiếu xu hướng chứ không phải quy công cho từng
   * nguồn. Ghi rõ ở đây để về sau không ai đọc nhầm thành doanh thu theo kênh.
   */
  async getSourceTable(opts: { from?: string; to?: string }): Promise<{
    source: string;
    campaign: string;
    loai: string;
    visits: number;
    visitors: number;
  }[]> {
    const params: unknown[] = [];
    // Cùng điều kiện "lượt xem thật" như các thống kê khác trong tệp này: bỏ
    // bot, và chỉ tính bước 'view' — nếu tính cả add_to_cart/begin_checkout thì
    // một người mua sẽ được đếm thành nhiều lượt và bảng nguồn bị thổi phồng.
    const dieuKien = [`v.is_bot = false AND v.event = 'view' AND ${KHONG_BOT}`];
    if (opts.from) {
      params.push(dateStart(opts.from));
      dieuKien.push(`v.created_at >= $${params.length}`);
    }
    if (opts.to) {
      params.push(dateEnd(opts.to));
      dieuKien.push(`v.created_at <= $${params.length}`);
    }

    const rows = await this.visitRepo.query(
      `SELECT ${NGUON}                       AS source,
              COALESCE(NULLIF(v.utm_campaign, ''), '—')   AS campaign,
              CASE
                -- Có utm_medium trả tiền → quảng cáo. Xét medium trước mọi thứ vì
                -- cùng một nguồn "google" vừa có thể là quảng cáo vừa có thể là
                -- SEO, và đó đúng là cặp dễ đọc nhầm nhất.
                WHEN LOWER(COALESCE(v.utm_medium, '')) IN ('cpc','ppc','paid','paid_social')
                  THEN 'quảng cáo'
                -- Chiến dịch của shop nhận diện bằng utm_CAMPAIGN, không phải
                -- utm_source. Công cụ tạo link quảng cáo bắt buộc điền chiến
                -- dịch, nên có utm_source mà trống campaign thì chắc chắn không
                -- phải link mình tạo — mà là bên khác tự gắn vào.
                WHEN NULLIF(v.utm_campaign, '') IS NOT NULL
                  THEN 'chiến dịch'
                -- ChatGPT và các trợ lý AI tự thêm ?utm_source=chatgpt.com vào
                -- link chúng đưa cho người dùng. Xếp chung vào "chiến dịch" là
                -- báo cáo sai: shop không hề chạy chiến dịch nào ở đó, mà đây
                -- lại là kênh đáng theo dõi riêng vì đang lớn dần.
                WHEN LOWER(COALESCE(NULLIF(v.utm_source, ''), ${REF_SACH}, ''))
                     ~ '(chatgpt|openai|perplexity|copilot|gemini|claude)'
                  THEN 'trợ lý AI'
                -- Máy tìm kiếm, kể cả khi tên nằm ở utm_source do bên kia gắn.
                WHEN COALESCE(NULLIF(v.utm_source, ''), ${REF_SACH}, '')
                     ~ '^(www\.)?(google|bing|coccoc|duckduckgo|yandex)\.'
                  OR v.referrer_host IN ('search.yahoo.com','vn.search.yahoo.com')
                  THEN 'tự nhiên (SEO)'
                WHEN COALESCE(NULLIF(v.utm_source, ''), ${REF_SACH}) IS NOT NULL
                  THEN 'giới thiệu'
                ELSE 'trực tiếp'
              END                                          AS loai,
              COUNT(*)                                    AS visits,
              COUNT(DISTINCT COALESCE(v.visitor_id, v.ip)) AS visitors
         FROM page_visits v
        WHERE ${dieuKien.join(' AND ')}
        GROUP BY 1, 2, 3
        ORDER BY visits DESC`,
      params,
    );

    return rows.map((r: any) => ({
      source: r.source,
      campaign: r.campaign,
      loai: r.loai,
      visits: Number(r.visits),
      visitors: Number(r.visitors),
    }));
  }

  // ── Visit stats ──────────────────────────────────────────────────────────────

  async getVisitStats(from?: string, to?: string) {
    const buildBase = () => {
      const qb = this.visitRepo.createQueryBuilder('v').where(LUOT_XEM_THAT);
      if (from) qb.andWhere('v.created_at >= :from', { from: dateStart(from) });
      if (to) qb.andWhere('v.created_at <= :to', { to: dateEnd(to) });
      return qb;
    };

    const [totalRaw, uniqueRaw, timelineRaw] = await Promise.all([
      buildBase().select('COUNT(*)', 'total').getRawOne<{ total: string }>(),
      buildBase().select('COUNT(DISTINCT v.ip)', 'unique').getRawOne<{ unique: string }>(),
      buildBase()
        .select("TO_CHAR(v.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'visits')
        .addSelect('COUNT(DISTINCT v.ip)', 'unique_visitors')
        .groupBy("TO_CHAR(v.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; visits: string; unique_visitors: string }>(),
    ]);

    return {
      total: Number(totalRaw?.total ?? 0),
      uniqueVisitors: Number(uniqueRaw?.unique ?? 0),
      timeline: timelineRaw.map(r => ({
        date: r.date,
        visits: Number(r.visits),
        uniqueVisitors: Number(r.unique_visitors),
      })),
    };
  }

  /**
   * Khách ghé thăm vào những khung giờ nào trong ngày.
   *
   * Để trại biết lúc nào nên đăng bài, chạy quảng cáo và trực Zalo. Đăng lúc
   * không ai online thì bài chìm mất trước khi có người thấy.
   *
   * Chia sáu khung ĐỀU NHAU bốn tiếng, không chia theo "sáng/trưa/chiều" dài
   * ngắn khác nhau: khung 2 tiếng và khung 5 tiếng đặt cạnh nhau thì con số
   * không so sánh được, mà bảng lại trông như so sánh được.
   *
   * Chỉ MỘT lần `AT TIME ZONE 'Asia/Ho_Chi_Minh'` vì cả page_visits.created_at
   * lẫn orders.created_at ở đây đều là TIMESTAMPTZ (đã kiểm bằng
   * information_schema) — Postgres tự biết mốc UTC, đổi thẳng sang giờ Việt là
   * đủ. Lưu ý: bên 17Fishing cột này là TIMESTAMP trần lưu giờ UTC nên phải đổi
   * hai bước; chép qua chép lại giữa hai dự án là lệch đúng 7 tiếng mà bảng
   * vẫn trông rất hợp lý.
   *
   * Đơn hàng gom theo giờ của CHÍNH nó, không truy ngược về lượt xem dẫn tới
   * đơn: câu hỏi ở đây là "khách đặt hàng vào lúc nào", để biết lúc nào cần
   * người trực điện thoại.
   */
  async getHourStats(from?: string, to?: string) {
    const GIO_VN = `AT TIME ZONE 'Asia/Ho_Chi_Minh'`;

    const visitQb = this.visitRepo.createQueryBuilder('v')
      .select(`FLOOR(EXTRACT(HOUR FROM v.created_at ${GIO_VN}) / 4)::int`, 'bucket')
      .addSelect('COUNT(*)', 'visits')
      .addSelect('COUNT(DISTINCT v.ip)', 'visitors')
      .groupBy('1')
      .where(LUOT_XEM_THAT);
    if (from) visitQb.andWhere('v.created_at >= :from', { from: dateStart(from) });
    if (to) visitQb.andWhere('v.created_at <= :to', { to: dateEnd(to) });

    const orderQb = this.orderRepo.createQueryBuilder('o')
      .select(`FLOOR(EXTRACT(HOUR FROM o.created_at ${GIO_VN}) / 4)::int`, 'bucket')
      .addSelect('COUNT(*)', 'orders')
      .where("o.status != 'cancelled'")
      .groupBy('1');
    if (from) orderQb.andWhere('o.created_at >= :from', { from: dateStart(from) });
    if (to) orderQb.andWhere('o.created_at <= :to', { to: dateEnd(to) });

    const [visits, orders] = await Promise.all([
      visitQb.getRawMany<{ bucket: number; visits: string; visitors: string }>(),
      orderQb.getRawMany<{ bucket: number; orders: string }>(),
    ]);

    const vMap = new Map(visits.map(r => [Number(r.bucket), r]));
    const oMap = new Map(orders.map(r => [Number(r.bucket), Number(r.orders)]));

    // Luôn trả đủ sáu khung kể cả khung không có ai: khung vắng cũng là thông
    // tin, và bảng thiếu dòng thì người đọc tưởng chưa có dữ liệu.
    return Array.from({ length: 6 }, (_, b) => ({
      bucket: b,
      label: `${String(b * 4).padStart(2, '0')}–${String(b * 4 + 4).padStart(2, '0')}h`,
      visits: Number(vMap.get(b)?.visits ?? 0),
      visitors: Number(vMap.get(b)?.visitors ?? 0),
      orders: oMap.get(b) ?? 0,
    }));
  }

  /**
   * Phễu theo từng sản phẩm: xem → thêm giỏ → vào đặt hàng → mua.
   *
   * Đọc theo chiều rơi rụng: xem nhiều mà thêm giỏ ít là vấn đề ở trang sản
   * phẩm (ảnh, mô tả, giá). Thêm giỏ nhiều mà vào đặt hàng ít là vướng ở giỏ.
   * Vào đặt hàng rồi mà không thành đơn là vướng ở chính khâu đặt hàng.
   *
   * Đếm số NGƯỜI (visitor_id) chứ không phải số lượt, trừ cột "lượt thêm giỏ" —
   * một người thêm giỏ ba lần là ba lần muốn mua, đáng biết, nhưng vẫn chỉ là
   * một người.
   *
   * Bỏ bot: bot đọc trang sản phẩm rất nhiều nhưng không bao giờ thêm giỏ, để
   * lẫn vào thì mọi sản phẩm đều trông như "xem nhiều, mua ít".
   *
   * Đường dẫn sản phẩm dạng /san-pham/<slug>; substring(path from 11) cắt đúng
   * mười ký tự đầu, rồi bỏ phần ?query và #hash để hai lượt vào cùng một sản
   * phẩm không bị đếm thành hai dòng.
   *
   * Bỏ hẳn sản phẩm KHÔNG có hoạt động nào — không ai xem và cũng không bán
   * được món nào. Trại có nhiều sản phẩm, để cả dòng toàn số 0 thì phải đọc
   * lướt qua chúng mỗi lần muốn tìm món đang có chuyện.
   *
   * Vẫn GIỮ sản phẩm không có lượt xem nhưng đã bán được. Nghe mâu thuẫn nhưng
   * xảy ra thật: đơn chốt qua Zalo hoặc điện thoại không sinh lượt xem nào, và
   * đơn đặt trước khi bật đo hành vi cũng vậy. Ẩn những dòng đó là giấu mất
   * doanh thu có thật khỏi bảng.
   */
  async getProductFunnel(from?: string, to?: string) {
    const params: unknown[] = [];
    // `visitor_id IS NOT NULL` là điều kiện QUAN TRỌNG NHẤT ở đây, không phải
    // để lọc rác mà để cả bốn cột phễu cùng nói về một thời kỳ.
    //
    // Migration đặt event='view' cho MỌI dòng cũ, và dòng cũ không có
    // visitor_id nên rơi về IP — thành ra lượt truy cập từ nhiều tháng trước
    // vẫn được đếm là "khách xem", trong khi "thêm giỏ" chỉ có từ lúc bật đo.
    // Hệ quả: mọi sản phẩm đều hiện "xem 3, thêm giỏ 0" và trông như trang sản
    // phẩm hỏng, dù thực ra chỉ là hai cột đo hai khoảng thời gian khác nhau.
    const vConds = [`v.is_bot = false`, KHONG_BOT, `v.path LIKE '/san-pham/%'`, `v.visitor_id IS NOT NULL`];
    const oConds = [`o.status <> 'cancelled'`, `(i->>'productId') IS NOT NULL`];
    if (from) {
      params.push(dateStart(from));
      vConds.push(`v.created_at >= $${params.length}`);
      oConds.push(`o.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(dateEnd(to));
      vConds.push(`v.created_at <= $${params.length}`);
      oConds.push(`o.created_at <= $${params.length}`);
    }

    const rows = await this.visitRepo.query(
      `WITH traffic AS (
         SELECT split_part(split_part(substring(v.path from 11), '?', 1), '#', 1) AS slug,
                COUNT(DISTINCT CASE WHEN v.event = 'view' THEN v.visitor_id END) AS viewers,
                COUNT(*) FILTER (WHERE v.event = 'add_to_cart') AS cart_events,
                COUNT(DISTINCT CASE WHEN v.event = 'add_to_cart' THEN v.visitor_id END) AS carters,
                COUNT(DISTINCT CASE WHEN v.event = 'begin_checkout' THEN v.visitor_id END) AS checkouters,
                -- Số khách CHẠM TỚI sản phẩm, gộp mọi kiểu tương tác.
                --
                -- Cần cái này làm mẫu số cho các tỉ lệ, không dùng được cột
                -- "khách xem": nút thêm giỏ nằm ngay trên thẻ sản phẩm ở trang
                -- danh sách, nên khách thêm giỏ được mà chưa từng mở trang chi
                -- tiết. Chia cho "khách xem" thì tỉ lệ vượt 100% (đã thấy 300%:
                -- 1 người xem, 3 người thêm giỏ) hoặc chia cho 0.
                COUNT(DISTINCT v.visitor_id) AS reachers
           FROM page_visits v
          WHERE ${vConds.join(' AND ')}
          GROUP BY 1
       ),
       sales AS (
         SELECT p.slug AS slug,
                COUNT(DISTINCT o.id) AS orders,
                -- Chỉ đếm đơn NỐI ĐƯỢC với người xem. Đơn chốt qua Zalo/điện
                -- thoại và đơn đặt trước khi bật đo đều không có visitor_id;
                -- COUNT(DISTINCT NULL) = 0 nên chúng không lọt vào đây. Bên
                -- CMS dựa vào "buyers = 0 nhưng đã bán > 0" để hiện dấu "—"
                -- thay vì "0%" — hai thứ đó nghĩa hoàn toàn khác nhau.
                COUNT(DISTINCT o.visitor_id) AS buyers,
                COALESCE(SUM((i->>'quantity')::numeric), 0) AS quantity_sold,
                COALESCE(SUM((i->>'price')::numeric * (i->>'quantity')::numeric), 0) AS revenue
           FROM orders o
           CROSS JOIN LATERAL jsonb_array_elements(o.items) AS i
           JOIN products p ON p.id::text = i->>'productId'
          WHERE ${oConds.join(' AND ')}
          GROUP BY p.slug
       )
       SELECT p.slug AS slug,
              p.name AS name,
              COALESCE(t.viewers, 0)       AS viewers,
              COALESCE(t.cart_events, 0)   AS cart_events,
              COALESCE(t.carters, 0)       AS carters,
              COALESCE(t.checkouters, 0)   AS checkouters,
              COALESCE(t.reachers, 0)      AS reachers,
              COALESCE(s.quantity_sold, 0) AS quantity_sold,
              COALESCE(s.orders, 0)        AS orders,
              COALESCE(s.buyers, 0)        AS buyers,
              COALESCE(s.revenue, 0)       AS revenue
         FROM products p
         LEFT JOIN traffic t ON t.slug = p.slug
         LEFT JOIN sales s   ON s.slug = p.slug
        -- Hiện dòng khi có BẤT KỲ dấu hiệu nào, không chỉ khi có lượt xem.
        --
        -- Điều kiện cũ chỉ nhận "có người xem trang sản phẩm HOẶC đã bán", nên
        -- một sản phẩm được thêm giỏ và mang sang trang đặt hàng mà khách chưa
        -- từng mở trang chi tiết thì BIẾN MẤT khỏi bảng, dù dữ liệu đã ghi đủ.
        --
        -- Đó không phải trường hợp hiếm: nút thêm giỏ nằm ngay trên thẻ sản
        -- phẩm ở trang danh sách và trang chủ, và luồng video cho mua thẳng —
        -- cả ba đường đều không đi qua trang chi tiết sản phẩm.
        WHERE COALESCE(t.viewers, 0) > 0
           OR COALESCE(t.carters, 0) > 0
           OR COALESCE(t.checkouters, 0) > 0
           OR COALESCE(s.quantity_sold, 0) > 0
        ORDER BY viewers DESC, quantity_sold DESC`,
      params,
    );

    return rows.map((r: Record<string, string>) => ({
      slug: r.slug,
      name: r.name,
      viewers: Number(r.viewers),
      cartEvents: Number(r.cart_events),
      carters: Number(r.carters),
      checkouters: Number(r.checkouters),
      reachers: Number(r.reachers),
      quantitySold: Number(r.quantity_sold),
      orders: Number(r.orders),
      buyers: Number(r.buyers),
      revenue: Number(r.revenue),
    }));
  }

  async getVisitTable(opts: { from?: string; to?: string; path?: string }) {
    const qb = this.visitRepo.createQueryBuilder('v')
      .select('v.path', 'path')
      .addSelect('COUNT(*)', 'visits')
      .addSelect('COUNT(DISTINCT v.ip)', 'unique_visitors')
      .groupBy('v.path')
      .orderBy('visits', 'DESC')
      .where(LUOT_XEM_THAT);

    if (opts.from) qb.andWhere('v.created_at >= :from', { from: dateStart(opts.from) });
    if (opts.to) qb.andWhere('v.created_at <= :to', { to: dateEnd(opts.to) });
    if (opts.path) qb.andWhere('v.path ILIKE :path', { path: `%${opts.path}%` });

    const rows = await qb.getRawMany<{ path: string; visits: string; unique_visitors: string }>();
    return rows.map(r => ({
      path: r.path,
      visits: Number(r.visits),
      uniqueVisitors: Number(r.unique_visitors),
    }));
  }

  // ── Order stats ──────────────────────────────────────────────────────────────

  async getOrderStats(from?: string, to?: string) {
    const buildBase = () => {
      const qb = this.orderRepo.createQueryBuilder('o')
        .where("o.status != 'cancelled'");
      if (from) qb.andWhere('o.created_at >= :from', { from: dateStart(from) });
      if (to) qb.andWhere('o.created_at <= :to', { to: dateEnd(to) });
      return qb;
    };

    const [totalRaw, byStatus, bySource, timelineRaw] = await Promise.all([
      buildBase()
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .getRawOne<{ orders: string; revenue: string }>(),
      this.orderRepo.createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where(from ? 'o.created_at >= :from' : '1=1', from ? { from: dateStart(from) } : {})
        .andWhere(to ? 'o.created_at <= :to' : '1=1', to ? { to: dateEnd(to) } : {})
        .groupBy('o.status')
        .getRawMany<{ status: string; count: string }>(),
      buildBase()
        .select('o.source', 'source')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .groupBy('o.source')
        .getRawMany<{ source: string; count: string; revenue: string }>(),
      buildBase()
        .select("TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .groupBy("TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; orders: string; revenue: string }>(),
    ]);

    return {
      totalOrders: Number(totalRaw?.orders ?? 0),
      totalRevenue: Number(totalRaw?.revenue ?? 0),
      byStatus: byStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      bySource: bySource.map(r => ({ source: r.source, count: Number(r.count), revenue: Number(r.revenue) })),
      timeline: timelineRaw.map(r => ({
        date: r.date,
        orders: Number(r.orders),
        revenue: Number(r.revenue),
      })),
    };
  }

  // ── Top products ─────────────────────────────────────────────────────────────

  async getTopProducts(from: string, to: string, limit = 20) {
    const rows = await this.orderRepo.query(`
      SELECT
        item->>'productId'  AS product_id,
        item->>'name'       AS name,
        item->>'unit'       AS unit,
        SUM((item->>'quantity')::int)                              AS total_qty,
        SUM((item->>'price')::numeric * (item->>'quantity')::int) AS total_revenue,
        COUNT(DISTINCT o.id)                                       AS order_count
      FROM orders o
      CROSS JOIN jsonb_array_elements(o.items) AS item
      WHERE o.status != 'cancelled'
        AND o.created_at >= $1
        AND o.created_at <= $2
      GROUP BY item->>'productId', item->>'name', item->>'unit'
      ORDER BY total_qty DESC
      LIMIT $3
    `, [dateStart(from), dateEnd(to), limit]);

    return rows.map((r: any) => ({
      productId: r.product_id,
      name: r.name,
      unit: r.unit ?? 'con',
      totalQty: Number(r.total_qty),
      totalRevenue: Number(r.total_revenue),
      orderCount: Number(r.order_count),
    }));
  }

  // ── Monthly compare ───────────────────────────────────────────────────────────

  async getMonthlyCompare() {
    // Dùng Intl với timeZone cố định thay vì Date.getFullYear()/getMonth() —
    // 2 hàm đó đọc theo giờ hệ thống server (thường UTC), sai lệch với giờ VN
    // trong vài tiếng đầu mỗi tháng mới.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: 'numeric',
    }).formatToParts(new Date());
    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const monthNum = Number(parts.find((p) => p.type === 'month')!.value);

    const month = `${year}-${String(monthNum).padStart(2, '0')}`;
    const prevTotal = year * 12 + (monthNum - 1) - 1;
    const prevYear = Math.floor(prevTotal / 12);
    const prevMonthNum = (prevTotal % 12) + 1;
    const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    const getStats = async (ym: string) => {
      const raw = await this.orderRepo.createQueryBuilder('o')
        .select('COUNT(*)', 'orders')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .where("o.status != 'cancelled'")
        .andWhere("TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = :ym", { ym })
        .getRawOne<{ orders: string; revenue: string }>();
      return { orders: Number(raw?.orders ?? 0), revenue: Number(raw?.revenue ?? 0) };
    };

    const [current, previous] = await Promise.all([getStats(month), getStats(prevMonth)]);

    const growth = (cur: number, prev: number) =>
      prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

    return {
      month,
      prevMonth,
      current,
      previous,
      revenueGrowth: growth(current.revenue, previous.revenue),
      ordersGrowth: growth(current.orders, previous.orders),
    };
  }

  // ── Product conversion ────────────────────────────────────────────────────────

  async getProductConversion(from: string, to: string) {
    const [products, visitRows, orderRows] = await Promise.all([
      this.productRepo.find({ select: ['id', 'name', 'slug'], where: { isActive: true } }),
      this.visitRepo.createQueryBuilder('v')
        .select('v.path', 'path')
        .addSelect('COUNT(*)', 'visits')
        .where("v.path LIKE '/san-pham/%'")
        .andWhere('v.created_at >= :from', { from: dateStart(from) })
        .andWhere('v.created_at <= :to', { to: dateEnd(to) })
        .groupBy('v.path')
        .getRawMany<{ path: string; visits: string }>(),
      this.orderRepo.query(`
        SELECT
          item->>'productId' AS product_id,
          COUNT(DISTINCT o.id) AS orders
        FROM orders o
        CROSS JOIN jsonb_array_elements(o.items) AS item
        WHERE o.status != 'cancelled'
          AND o.created_at >= $1
          AND o.created_at <= $2
        GROUP BY item->>'productId'
      `, [dateStart(from), dateEnd(to)]),
    ]);

    const visitsBySlug: Record<string, number> = {};
    for (const row of visitRows) {
      const slug = row.path.replace('/san-pham/', '');
      visitsBySlug[slug] = Number(row.visits);
    }

    const ordersByProductId: Record<string, number> = {};
    for (const row of orderRows) {
      if (row.product_id) ordersByProductId[row.product_id] = Number(row.orders);
    }

    return products
      .map(p => {
        const views = visitsBySlug[p.slug] ?? 0;
        const orders = ordersByProductId[p.id] ?? 0;
        const conversionRate = views > 0 ? Math.round((orders / views) * 1000) / 10 : null;
        return { productId: p.id, name: p.name, slug: p.slug, views, orders, conversionRate };
      })
      .filter(r => r.views > 0 || r.orders > 0)
      .sort((a, b) => (b.views + b.orders * 10) - (a.views + a.orders * 10));
  }

  /**
   * Soi nhóm "trực tiếp" — chuyển từ 17fishing sang ngày 22/09/2026.
   *
   * Vì sao cần: đo 90 ngày thì GaRutin có **87%** lượt rơi vào nhóm trực tiếp
   * (1.406/1.614), trong khi 17fishing chỉ 50%. Bảng nguồn không nói được đó
   * là người hay máy, vì nó chỉ nhóm theo referrer và UTM.
   *
   * Bốn phép đo, mỗi cái bắt một kiểu bot khác nhau:
   *   uaTop    UA kèm SỐ LƯỢT và số khách — bot lặp một UA rất nhiều lần
   *   theoGio  phân bố giờ VN của RIÊNG nhóm này — bot rải đều 24h
   *   doSau    số trang mỗi khách — bot hoặc 1 trang, hoặc hàng trăm
   *   tuongTac sự kiện khác 'view' của chính nhóm đó
   *
   * Phép cuối mạnh nhất vì không dựa vào User-Agent, mà UA thì bot giả được.
   */
  async soiTrucTiep(): Promise<{
    uaTop: { ua: string; luot: number; khach: number }[];
    theoGio: { bucket: number; luot: number }[];
    doSau: { nhom: string; khach: number; luot: number }[];
    tuongTac: { event: string; luot: number; khach: number }[];
  }> {
    // Dùng hằng NGUON ở đầu tệp — không chép lại biểu thức nguồn.
    const uaTop = await this.visitRepo.query(
      `SELECT COALESCE(NULLIF(v.user_agent, ''), '(không có UA)') AS ua,
              COUNT(*)::int AS luot,
              COUNT(DISTINCT COALESCE(v.visitor_id, v.ip))::int AS khach
         FROM page_visits v
        WHERE ${LUOT_XEM_THAT} AND ${NGUON} = 'trực tiếp'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 25`,
    );
    const theoGio = await this.visitRepo.query(
      // Một bước. created_at là TIMESTAMPTZ; công thức hai bước là dấu hiệu lỗi.
      `SELECT FLOOR(EXTRACT(HOUR FROM v.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') / 4)::int AS bucket,
              COUNT(*)::int AS luot
         FROM page_visits v
        WHERE ${LUOT_XEM_THAT} AND ${NGUON} = 'trực tiếp'
        GROUP BY 1 ORDER BY 1`,
    );
    const doSau = await this.visitRepo.query(
      `SELECT CASE WHEN n = 1 THEN '1 trang'
                   WHEN n BETWEEN 2 AND 3 THEN '2-3 trang'
                   WHEN n BETWEEN 4 AND 10 THEN '4-10 trang'
                   ELSE 'hơn 10 trang' END AS nhom,
              COUNT(*)::int AS khach, SUM(n)::int AS luot
         FROM (SELECT COALESCE(v.visitor_id, v.ip) AS ai, COUNT(*)::int AS n
                 FROM page_visits v
                WHERE ${LUOT_XEM_THAT} AND ${NGUON} = 'trực tiếp'
                GROUP BY 1) t
        GROUP BY 1 ORDER BY 2 DESC`,
    );
    const tuongTac = await this.visitRepo.query(
      `SELECT v.event, COUNT(*)::int AS luot,
              COUNT(DISTINCT COALESCE(v.visitor_id, v.ip))::int AS khach
         FROM page_visits v
        WHERE v.event <> 'view' AND v.is_bot = false AND ${KHONG_BOT}
          AND COALESCE(v.visitor_id, v.ip) IN (
                SELECT COALESCE(x.visitor_id, x.ip) FROM page_visits x
                 WHERE x.event = 'view' AND x.is_bot = false
                   AND (x.user_agent IS NULL OR x.user_agent !~* '${BOT_DOC}')
                   AND ${NGUON.replace(/v\./g, 'x.')} = 'trực tiếp')
        GROUP BY 1 ORDER BY 2 DESC`,
    );
    return { uaTop, theoGio, doSau, tuongTac };
  }

}
