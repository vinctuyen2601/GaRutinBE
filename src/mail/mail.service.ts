import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { SiteConfigService } from '../site-config/site-config.service';
import { Order } from '../orders/entities/order.entity';

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n));

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly siteConfigService: SiteConfigService) {
    const apiKey = process.env.RESEND_API_KEY;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendNewOrderAlert(order: Order): Promise<void> {
    try {
      await this.doSendNewOrderAlert(order);
    } catch (err) {
      this.logger.error(`Gửi email cảnh báo đơn hàng thất bại: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  private async doSendNewOrderAlert(order: Order): Promise<void> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY chưa cấu hình — bỏ qua gửi email cảnh báo đơn hàng');
      return;
    }

    const to = await this.siteConfigService.get('order_alert_email');
    if (!to) {
      this.logger.warn('Chưa cấu hình "order_alert_email" trong Cài đặt — bỏ qua gửi email cảnh báo đơn hàng');
      return;
    }

    const from = process.env.RESEND_FROM || 'GaRutin <onboarding@resend.dev>';
    const cmsUrl = process.env.CMS_URL || 'https://cms.garutin.com';
    const orderLink = `${cmsUrl}/orders/${order.id}`;

    const itemsHtml = order.items
      .map(
        (item) =>
          `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.name}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity} ${item.unit}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtVND(item.price)}</td>
          </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <h2 style="color:#16a34a;">🔔 Đơn hàng mới #${order.orderNumber}</h2>
        <p><b>Khách hàng:</b> ${order.customerName} — ${order.customerPhone}</p>
        ${order.customerAddress ? `<p><b>Địa chỉ:</b> ${order.customerAddress}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:6px 8px;text-align:left;">Sản phẩm</th>
              <th style="padding:6px 8px;">SL</th>
              <th style="padding:6px 8px;text-align:right;">Giá</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="font-size:18px;"><b>Tổng tiền: ${fmtVND(order.totalAmount)}</b></p>
        ${order.notes ? `<p><b>Ghi chú:</b> ${order.notes}</p>` : ''}
        <p style="margin-top:20px;">
          <a href="${orderLink}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
            Xem đơn hàng trong CMS
          </a>
        </p>
      </div>
    `;

    const { error } = await this.resend.emails.send({
      from,
      to,
      subject: `🔔 Đơn hàng mới #${order.orderNumber} — ${fmtVND(order.totalAmount)}`,
      html,
    });
    if (error) {
      throw new Error(`Resend API error (${error.name}): ${error.message}`);
    }
  }
}
