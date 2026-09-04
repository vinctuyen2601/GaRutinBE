import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationChannel } from './entities/notification-channel.entity';
import { CreateNotificationChannelDto, UpdateNotificationChannelDto } from './dto/notification-channel.dto';
import { sendTelegram } from './adapters/telegram.adapter';
import { sendZalo } from './adapters/zalo.adapter';
import { sendEmail } from './adapters/email.adapter';

const SHOP = 'GaRutin';

const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(Number(n)) + ' ₫';

/**
 * Thoát ký tự HTML cho mọi giá trị do khách nhập.
 *
 * Tên, địa chỉ, ghi chú và tên sản phẩm trong đơn đều đi vào hệ thống qua
 * endpoint đặt hàng công khai, không cần đăng nhập. Telegram gửi với
 * parse_mode HTML nên chỉ cần khách gõ một dấu '<' trong ghi chú là cả tin
 * nhắn bị Telegram từ chối và mất luôn thông báo đơn hàng đó. Với email thì
 * còn tệ hơn: nội dung khách nhập được chèn thẳng vào hộp thư của chủ trại.
 */
const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Telegram chặn tin nhắn quá 4096 ký tự — bị chặn là mất trắng cả thông báo. */
const TELEGRAM_MAX = 4096;
const MAX_ITEMS_IN_MESSAGE = 15;

const capLength = (msg: string): string =>
  msg.length <= TELEGRAM_MAX ? msg : `${msg.slice(0, TELEGRAM_MAX - 40)}\n… (đã cắt bớt)`;

/** Đường dẫn tới CMS, bỏ dấu / thừa ở cuối để không sinh ra // giữa đường dẫn. */
const cmsLink = (path: string): string =>
  `${(process.env.CMS_URL || 'https://cms.garutin.com').replace(/\/+$/, '')}${path}`;

/** Tin nhắn dạng dòng của Telegram/Zalo hiển thị được trong email. */
const textToHtml = (message: string): string =>
  `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;">${message.replace(/\n/g, '<br>')}</div>`;

/**
 * Nhãn trạng thái đơn. Đúng theo Order.status của dự án này — không có
 * 'returned' như bên 17Fishing, thêm vào chỉ tạo ra nhãn không bao giờ dùng.
 */
const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};

const SOURCE_LABELS: Record<string, string> = {
  web: 'Website', zalo: 'Zalo', phone: 'Điện thoại', other: 'Khác',
};

/**
 * Nội dung email cho đơn hàng mới.
 *
 * Dùng bảng và thuộc tính style nội tuyến chứ không dùng CSS hay flexbox:
 * Gmail và Outlook lược bỏ phần lớn CSS đặt trong thẻ style, còn ứng dụng
 * Gmail trên điện thoại thì bỏ luôn cả layout hiện đại. Đây là kiểu viết xấu
 * nhưng là kiểu duy nhất hiển thị đúng ở mọi nơi.
 */
function newOrderHtml(order: any): string {
  const orderLink = cmsLink(`/orders/${order.id}`);
  const items: any[] = Array.isArray(order.items) ? order.items : [];

  const itemsHtml = items
    .map(
      (i) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${esc(i.name)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;white-space:nowrap;">
          ${esc(i.quantity)}${i.unit ? ` ${esc(i.unit)}` : ''}
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">
          ${fmtVND(i.price)}
        </td>
      </tr>`,
    )
    .join('');

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:3px 0;color:#6b7280;white-space:nowrap;">${label}</td>
      <td style="padding:3px 0 3px 12px;">${value}</td>
    </tr>`;

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#111827;">
      <h2 style="margin:0 0 4px;font-size:20px;color:#16a34a;">🛒 Đơn mới ${esc(order.orderNumber)}</h2>
      <div style="color:#6b7280;font-size:13px;margin-bottom:16px;">Thanh toán khi nhận hàng (COD)</div>

      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px;">
        ${row('Khách hàng', `<b>${esc(order.customerName) || '—'}</b>`)}
        ${row('Điện thoại', `<a href="tel:${esc(order.customerPhone)}" style="color:#1d4ed8;">${esc(order.customerPhone) || '—'}</a>`)}
        ${order.customerAddress ? row('Địa chỉ', esc(order.customerAddress)) : ''}
        ${order.source && order.source !== 'web' ? row('Nguồn', esc(SOURCE_LABELS[order.source] ?? order.source)) : ''}
        ${order.notes ? row('Ghi chú', `<i>${esc(order.notes)}</i>`) : ''}
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;">Sản phẩm</th>
            <th style="padding:8px;text-align:center;">SL</th>
            <th style="padding:8px;text-align:right;">Giá</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <div style="text-align:right;font-size:18px;font-weight:700;margin-top:8px;">
        Tổng: ${fmtVND(order.totalAmount)}
      </div>

      <p style="margin-top:24px;">
        <a href="${orderLink}"
           style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
          Mở đơn trong CMS
        </a>
      </p>
    </div>
  `;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationChannel)
    private readonly repo: Repository<NotificationChannel>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────
  findAll() { return this.repo.find({ order: { createdAt: 'DESC' } }); }

  findOne(id: string) { return this.repo.findOneByOrFail({ id }); }

  create(dto: CreateNotificationChannelDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateNotificationChannelDto) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  remove(id: string) { return this.repo.delete(id); }

  // ── Dispatch ──────────────────────────────────────────────────────────
  /**
   * `email` cho phép truyền tiêu đề và nội dung HTML riêng. Telegram và Zalo
   * hiển thị tin nhắn ngắn gọn là hợp, còn email thì chủ trại mở ra để làm việc
   * nên đáng có bảng hàng và nút mở đơn trong CMS.
   */
  async dispatch(
    event: string,
    message: string,
    email?: { subject: string; html: string },
  ): Promise<void> {
    const channels = await this.repo.find({ where: { isActive: true } });
    const targets = channels.filter(c => c.events.includes(event));

    await Promise.allSettled(
      targets.map(c => this.send(c, message, email)),
    );
  }

  /** Gửi thật, để lỗi ném ra ngoài. */
  private async deliver(
    channel: NotificationChannel,
    message: string,
    email?: { subject: string; html: string },
  ): Promise<void> {
    if (channel.type === 'telegram') {
      await sendTelegram(channel.config.botToken, channel.config.chatId, message);
    } else if (channel.type === 'zalo') {
      await sendZalo(channel.config.accessToken, channel.config.userId, message);
    } else if (channel.type === 'email') {
      await sendEmail(
        channel.config.to,
        email?.subject ?? `${SHOP} — thông báo`,
        email?.html ?? textToHtml(message),
      );
    } else {
      throw new Error(`Loại kênh không hỗ trợ: ${channel.type}`);
    }
  }

  /** Gửi trong luồng thông báo thật: một kênh hỏng không được kéo đổ các kênh khác. */
  private async send(
    channel: NotificationChannel,
    message: string,
    email?: { subject: string; html: string },
  ): Promise<void> {
    try {
      await this.deliver(channel, message, email);
    } catch (err) {
      this.logger.error(`Channel "${channel.name}" failed: ${(err as Error).message}`);
    }
  }

  // ── Test ──────────────────────────────────────────────────────────────
  /**
   * Gọi deliver chứ không gọi send: send nuốt lỗi để một kênh hỏng không kéo
   * đổ các kênh khác, nhưng ở đây nuốt lỗi thì nút "Gửi thử" luôn báo thành
   * công kể cả khi cấu hình sai — đúng lúc người dùng cần biết sự thật nhất.
   */
  async test(id: string): Promise<{ ok: boolean; error?: string }> {
    const channel = await this.findOne(id);
    try {
      const name = esc(channel.name);
      const msg = `✅ <b>Kết nối thành công!</b>\nKênh <b>${name}</b> đã được cấu hình đúng.`;
      await this.deliver(channel, msg, {
        subject: `✅ ${SHOP} — kênh "${channel.name}" đã kết nối`,
        html: textToHtml(msg),
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  // ── Event Listeners ───────────────────────────────────────────────────

  @OnEvent('order.created')
  onOrderCreated(order: any) {
    const items: any[] = Array.isArray(order.items) ? order.items : [];

    // Cắt bớt khi đơn quá dài: Telegram chặn tin nhắn trên 4096 ký tự, và bị
    // chặn thì mất trắng cả thông báo chứ không phải mất phần thừa.
    const shown = items.slice(0, MAX_ITEMS_IN_MESSAGE);
    const lines = shown.map(
      i => `• ${esc(i.name)} × ${esc(i.quantity)}${i.unit ? ` ${esc(i.unit)}` : ''} — ${fmtVND(i.price)}`,
    );
    if (items.length > shown.length) {
      lines.push(`• … và ${items.length - shown.length} sản phẩm nữa`);
    }

    const msg = [
      `🛒 <b>ĐƠN HÀNG MỚI</b> · <code>${esc(order.orderNumber)}</code>`,
      ``,
      `👤 ${esc(order.customerName) || '—'} · ${esc(order.customerPhone) || '—'}`,
      order.customerAddress ? `📍 ${esc(order.customerAddress)}` : null,
      order.notes ? `📝 ${esc(order.notes)}` : null,
      ``,
      ...lines,
      ``,
      `💰 <b>Tổng: ${fmtVND(order.totalAmount)}</b> · 💵 COD`,
      order.source && order.source !== 'web'
        ? `📣 Nguồn: ${esc(SOURCE_LABELS[order.source] ?? order.source)}`
        : null,
      order.id ? `\n<a href="${cmsLink(`/orders/${order.id}`)}">Mở đơn trong CMS</a>` : null,
    ].filter(v => v !== null).join('\n');

    this.dispatch('order.created', capLength(msg), {
      subject: `🛒 Đơn mới ${order.orderNumber} — ${fmtVND(order.totalAmount)}`,
      html: newOrderHtml(order),
    }).catch(() => {});
  }

  @OnEvent('order.status_updated')
  onOrderStatusUpdated(order: any) {
    const to = STATUS_LABELS[order.status] ?? order.status;
    const from = order.previousStatus ? STATUS_LABELS[order.previousStatus] ?? order.previousStatus : null;

    const msg = [
      `📦 <b>Cập nhật đơn hàng</b> · <code>${esc(order.orderNumber)}</code>`,
      `👤 ${esc(order.customerName) || '—'} · ${esc(order.customerPhone) || '—'}`,
      from && from !== to
        ? `Trạng thái: ${esc(from)} → <b>${esc(to)}</b>`
        : `Trạng thái: <b>${esc(to)}</b>`,
      `💰 ${fmtVND(order.totalAmount)}`,
      order.id ? `\n<a href="${cmsLink(`/orders/${order.id}`)}">Mở đơn trong CMS</a>` : null,
    ].filter(v => v !== null).join('\n');

    this.dispatch('order.status_updated', capLength(msg), {
      subject: `📦 ${order.orderNumber} — ${to}`,
      html: textToHtml(capLength(msg)),
    }).catch(() => {});
  }
}
