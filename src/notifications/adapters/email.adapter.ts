import { Resend } from 'resend';

/**
 * Gửi email qua Resend.
 *
 * Khoá API và địa chỉ người gửi là cấu hình hạ tầng nên đọc từ biến môi
 * trường, không để trong config của từng kênh: Resend chỉ cho gửi từ tên miền
 * đã xác thực, để chủ trại tự gõ địa chỉ người gửi thì chỉ tạo ra lỗi khó hiểu.
 * Người nhận thì ngược lại, thuộc về từng kênh.
 *
 * Dùng lại đúng hai biến RESEND_API_KEY và RESEND_FROM mà MailService cũ đã
 * dùng, nên máy chủ đang chạy không phải khai thêm gì.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình RESEND_API_KEY trên máy chủ');
  }

  // Cho phép nhiều người nhận, ngăn cách bằng dấu phẩy — hai người cùng trông
  // đơn là chuyện bình thường.
  const recipients = to.split(',').map(s => s.trim()).filter(Boolean);
  if (!recipients.length) {
    throw new Error('Kênh email chưa có địa chỉ người nhận');
  }

  const { error } = await new Resend(apiKey).emails.send({
    from: process.env.RESEND_FROM || 'GaRutin <onboarding@resend.dev>',
    to: recipients,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend lỗi (${error.name}): ${error.message}`);
  }
}
