/**
 * Diễn giải lỗi của Telegram thành việc cần làm.
 *
 * Telegram trả về tiếng Anh rất cụt, kiểu "chat not found", mà người đọc thông
 * báo này là chủ shop chứ không phải lập trình viên. Nguyên văn vẫn được giữ ở
 * cuối để còn tra khi cần.
 */
function explain(description: string): string | null {
  const d = description.toLowerCase();

  if (d.includes('chat not found')) {
    return [
      'Không tìm thấy đoạn chat — Chat ID sai hoặc bot chưa có mặt ở đó.',
      'Với nhóm: phải thêm bot vào nhóm trước, và ID nhóm bắt đầu bằng dấu trừ (thường là -100...).',
      'Với cá nhân: người nhận phải bấm Start với bot ít nhất một lần.',
      'Nhóm thường được nâng cấp thành siêu nhóm thì ID cũng đổi, phải lấy lại.',
    ].join(' ');
  }
  if (d.includes('bot was kicked') || d.includes('bot is not a member')) {
    return 'Bot đã bị xoá khỏi nhóm. Thêm bot trở lại nhóm rồi thử lại.';
  }
  if (d.includes('blocked by the user')) {
    return 'Người nhận đã chặn bot. Bỏ chặn rồi bấm Start lại.';
  }
  if (d.includes('unauthorized')) {
    return 'Bot Token sai hoặc bot đã bị xoá. Lấy lại token từ @BotFather.';
  }
  if (d.includes('not found')) {
    return 'Bot Token sai hoặc đang để trống. Kiểm tra lại token từ @BotFather.';
  }
  if (d.includes("can't parse entities") || d.includes('can t parse entities')) {
    return 'Nội dung tin nhắn có ký tự HTML không hợp lệ.';
  }
  if (d.includes('too many requests') || d.includes('retry after')) {
    return 'Gửi quá nhiều trong thời gian ngắn, Telegram tạm chặn. Chờ một lát rồi thử lại.';
  }
  return null;
}

export async function sendTelegram(botToken: string, chatId: string, text: string): Promise<void> {
  if (!botToken) throw new Error('Kênh Telegram chưa có Bot Token');
  if (!chatId) throw new Error('Kênh Telegram chưa có Chat ID');

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let description = raw;
    try {
      description = (JSON.parse(raw) as { description?: string }).description || raw;
    } catch {
      // Telegram trả về thứ không phải JSON (proxy chặn, lỗi mạng) — giữ nguyên văn.
    }
    const hint = explain(description);
    throw new Error(hint ? `${hint} (Telegram: ${description})` : `Telegram: ${description}`);
  }
}
