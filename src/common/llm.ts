/**
 * Multi-provider LLM helper with automatic fallback and key rotation.
 *
 * Supported env vars (comma-separated for multiple keys):
 *   GROQ_API_KEY       — groq.com (free tier: ~500 req/day, 6000 tok/min)
 *   GEMINI_API_KEY     — aistudio.google.com (free: 15 req/min, 1500 req/day)
 *   CEREBRAS_API_KEY   — inference.cerebras.ai (free tier)
 *   OPENROUTER_API_KEY — openrouter.ai (free models available)
 *
 * Multiple keys example:
 *   GROQ_API_KEY=key1,key2,key3
 */

/**
 * Escape các ký tự newline/tab thực sự nằm bên trong JSON string values.
 * AI thường trả HTML nhiều dòng mà không escape → JSON.parse fail.
 */
function fixJsonStringNewlines(raw: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') {
        result += '\\n';
        continue;
      }
      if (ch === '\r') {
        result += '\\r';
        continue;
      }
      if (ch === '\t') {
        result += '\\t';
        continue;
      }
    }

    result += ch;
  }

  return result;
}

/**
 * Extract JSON từ AI response — xử lý các trường hợp:
 * - Bọc trong ```json ... ```
 * - Có text giải thích trước/sau JSON
 * - JSON string values chứa newline thực sự (HTML nhiều dòng)
 */
export function parseJsonFromAI<T = any>(text: string, context?: string): T {
  const candidates: string[] = [];

  // 1. Text gốc
  candidates.push(text.trim());

  // 2. Bóc markdown code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (codeBlock) candidates.push(codeBlock[1].trim());

  // 3. Tìm JSON object đầu tiên
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    // Thử parse thẳng
    try {
      return JSON.parse(candidate);
    } catch {}
    // Thử sau khi fix newlines bên trong strings
    try {
      return JSON.parse(fixJsonStringNewlines(candidate));
    } catch {}
  }

  // Không parse được — log để debug
  // Ghi cả ĐỘ DÀI và ĐUÔI chứ không chỉ phần đầu. Chỉ xem phần đầu thì không
  // phân biệt được "AI trả về thiếu" với "log bị cắt" — đã mất một vòng deploy
  // vì đúng chỗ này. Có đuôi là nhìn phát biết ngay JSON kết thúc đàng hoàng
  // hay đứt giữa chừng.
  console.error(
    `[LLM] JSON parse failed${context ? ` (${context})` : ''} — dài ${text.length} ký tự
` +
      `  đầu: ${text.slice(0, 300)}
` +
      `  đuôi: ${text.slice(-300)}`,
  );
  throw new Error('AI trả về dữ liệu không hợp lệ, vui lòng thử lại');
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LLMProfile = 'fast' | 'quality';

interface CallOptions {
  maxTokens?: number;
  /**
   * Bắt nhà cung cấp trả về JSON hợp lệ, không phải văn xuôi.
   *
   * Dặn trong prompt là chưa đủ. Đã xảy ra thật với gpt-oss-120b: prompt in
   * thẳng khuôn JSON, mô hình vẫn trả về bảng tự chấm điểm từng quy tắc bằng
   * tiếng Anh và không có lấy một dấu ngoặc nhọn nào.
   *
   * Cả bốn nhà cung cấp đều nói giao thức OpenAI nên đều hiểu response_format.
   * Nhà nào không hiểu thì trả 400, vòng lặp tự rơi sang nhà kế tiếp — mất một
   * lựa chọn cho lần gọi đó, không hỏng cả lệnh.
   *
   * Lưu ý: chế độ này đòi chữ "json" phải xuất hiện đâu đó trong tin nhắn.
   * Mọi prompt dùng nó đều đã có, nhưng viết prompt mới thì phải nhớ.
   */
  jsonMode?: boolean;
  temperature?: number;
  profile?: LLMProfile;
  /**
   * Thời gian chờ riêng cho lần gọi này, ghi đè TIMEOUT_MS.
   *
   * Cần thiết vì các việc khác nhau nặng rất khác nhau. Viết lại nguyên một bài
   * mất 26–28 giây nên phải chờ lâu; còn xin vài dòng metadata SEO thì đáng lẽ
   * chỉ vài giây. Dùng chung một mức chờ dài cho cả hai nghĩa là một nhà cung
   * cấp treo sẽ ăn hết 55 giây của cả việc nhẹ — đã xảy ra thật: gemini treo
   * 55s trong optimizeSeo, đủ để CloudFront cắt kết nối trước khi groq kịp
   * trả lời thành công.
   */
  timeoutMs?: number;
}

interface ProviderDef {
  name: string;
  url: string;
  model: string;
  envKey: string;
  /** Một số model không hỗ trợ role "system" → merge vào user message đầu tiên */
  mergeSystemIntoUser?: boolean;
}

// Cooldown tracking: key → timestamp khi hết cooldown
const rateLimitCooldown = new Map<string, number>();
const COOLDOWN_TPM_MS = 60_000; // 60s  — rate limit per minute (Groq TPM)
const COOLDOWN_QUOTA_MS = 6 * 3600_000; // 6h   — daily quota exhausted (Gemini)
const COOLDOWN_TIMEOUT_MS = 120_000; // 2m   — nhà cung cấp treo, không phản hồi

function isRateLimited(key: string): boolean {
  const until = rateLimitCooldown.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    rateLimitCooldown.delete(key);
    return false;
  }
  return true;
}

/**
 * Cho một key tạm nghỉ sau khi nó chạm thời gian chờ.
 *
 * Không có cái này thì một nhà cung cấp đang treo sẽ ăn trọn hạn chờ của MỌI
 * yêu cầu, mãi mãi. Đã xảy ra thật: gemini treo, mà profile 'quality' xếp
 * gemini chạy trước, nên mỗi lần gọi đều mất 20 giây vô ích rồi mới tới groq —
 * cộng lại vượt trần 30 giây của CloudFront và người dùng nhận 504, dù groq
 * hoàn toàn khoẻ.
 *
 * Nghỉ ngắn (2 phút) chứ không dài như quota: nhà cung cấp treo thường là trục
 * trặc nhất thời, nghỉ lâu thì tự tay bỏ mất một nhà cung cấp tốt.
 */
function markTimedOut(key: string): void {
  rateLimitCooldown.set(key, Date.now() + COOLDOWN_TIMEOUT_MS);
  console.warn(
    `[LLM] Key ...${key.slice(-6)} tạm nghỉ ${
      COOLDOWN_TIMEOUT_MS / 1000
    }s vì không phản hồi`,
  );
}

/** Phân biệt rate limit tạm thời vs quota ngày hết */
function markRateLimited(key: string, body: string): void {
  const isQuotaExhausted =
    body.includes('exceeded your current quota') ||
    (body.includes('quota') &&
      !body.includes('per minute') &&
      !body.includes('per_minute'));
  const cooldownMs = isQuotaExhausted ? COOLDOWN_QUOTA_MS : COOLDOWN_TPM_MS;
  rateLimitCooldown.set(key, Date.now() + cooldownMs);
  console.warn(
    `[LLM] Key ...${key.slice(-6)} cooldown ${cooldownMs / 1000}s (${
      isQuotaExhausted ? 'quota exhausted' : 'TPM rate limit'
    })`,
  );
}

/** Parse comma-separated keys từ env var, lọc bỏ empty */
function parseKeys(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Tên model đọc từ biến môi trường trước, mã nguồn chỉ là giá trị dự phòng.
 *
 * Đây là điểm mấu chốt: nhà cung cấp khai tử model liên tục, và mỗi lần như vậy
 * TẤT CẢ provider cùng trả 404, tính năng viết bài chết hẳn cho tới khi có người
 * sửa mã và triển khai lại. Ngày 07/09/2026 cả bốn cùng chết một lúc đúng vì
 * bốn tên đều ghi cứng.
 *
 * Có biến môi trường thì lần sau chỉ cần đổi một dòng trong .env rồi
 * `pm2 restart garutin-be` — không cần sửa mã, không cần chờ deploy.
 */
/**
 * Thời gian chờ tối đa cho MỘT lần gọi tới một nhà cung cấp.
 *
 * Trước đây không có thời gian chờ nào cả. Một nhà cung cấp treo là treo luôn
 * yêu cầu HTTP của người dùng, cho tới khi một tầng nào đó ở giữa bỏ cuộc và
 * trả về 500 không kèm lý do — rất khó lần ra vì log ứng dụng không ghi gì.
 *
 * ĐÂY KHÔNG PHẢI cách sửa lỗi 500 khi viết lại bài dài. Lỗi đó do CloudFront
 * cắt kết nối tới máy chủ ở 30 giây (mặc định) trong khi viết lại một bài dài
 * mất 26–28 giây — phải nâng ngưỡng đó lên 60 giây ở console CloudFront thì
 * mới hết. Thời gian chờ ở đây chỉ là lưới an toàn chống treo vô hạn.
 *
 * Vì vậy đặt mặc định 55 giây: cao hơn hẳn 26–28 giây của một lần chạy bình
 * thường (đặt 25 giây là giết luôn cả những lần đang chạy được), và vẫn thấp
 * hơn `proxy_read_timeout` mặc định 60 giây của nginx để lỗi bật ra từ ứng
 * dụng — nơi có log nói rõ nhà cung cấp nào chậm — chứ không phải từ nginx.
 */
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 55_000);

const model = (bien: string, macDinh: string) =>
  (process.env[bien] ?? '').trim() || macDinh;

const PROVIDER_DEFS: ProviderDef[] = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    // llama-3.3-70b-versatile ngừng phục vụ 16/08/2026; Groq chỉ định thay bằng
    // openai/gpt-oss-120b (hoặc qwen/qwen3.6-27b).
    model: model('GROQ_MODEL', 'openai/gpt-oss-120b'),
    envKey: 'GROQ_API_KEY',
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    // gemini-2.5-flash không còn mở cho tài khoản mới; chính thông báo lỗi của
    // Google chỉ sang gemini-3.6-flash.
    model: model('GEMINI_MODEL', 'gemini-3.6-flash'),
    envKey: 'GEMINI_API_KEY',
  },
  {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    // llama3.1-8b không còn trên endpoint công khai; hiện chỉ còn gpt-oss-120b
    // và qwen-3.8-27b được phục vụ rộng rãi.
    model: model('CEREBRAS_MODEL', 'gpt-oss-120b'),
    envKey: 'CEREBRAS_API_KEY',
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    // Không ghim một model miễn phí cụ thể nữa. google/gemini-2.5-flash:free bị
    // gỡ khỏi nhóm miễn phí và đó chính là thứ đã hạ gục provider này — ghim
    // gemma-4-31b-it thay vào chỉ là dời ngày chết. openrouter/free là bộ định
    // tuyến, tự chọn trong nhóm miễn phí còn phục vụ nên không chết theo một
    // model lẻ. Bên 17Fishing đã dùng cách này và không dính đợt hỏng vừa rồi.
    model: model('OPENROUTER_MODEL', 'openrouter/free'),
    envKey: 'OPENROUTER_API_KEY',
  },
];

const FAST_ORDER = ['groq', 'cerebras', 'gemini', 'openrouter'];
const QUALITY_ORDER = ['gemini', 'groq', 'cerebras', 'openrouter'];

interface ProviderAttempt {
  def: ProviderDef;
  key: string;
}

/** Trả về danh sách (provider, key) theo thứ tự ưu tiên, bỏ qua key đang cooldown */
function buildAttempts(profile: LLMProfile): ProviderAttempt[] {
  const order = profile === 'quality' ? QUALITY_ORDER : FAST_ORDER;
  const attempts: ProviderAttempt[] = [];

  for (const name of order) {
    const def = PROVIDER_DEFS.find((p) => p.name === name)!;
    const keys = parseKeys(process.env[def.envKey]);
    for (const key of keys) {
      if (!isRateLimited(key)) {
        attempts.push({ def, key });
      }
    }
  }

  // Nếu tất cả đều đang cooldown, thêm lại để thử (ít nhất còn cơ hội)
  if (attempts.length === 0) {
    for (const name of order) {
      const def = PROVIDER_DEFS.find((p) => p.name === name)!;
      const keys = parseKeys(process.env[def.envKey]);
      for (const key of keys) {
        attempts.push({ def, key });
      }
    }
  }

  return attempts;
}

/** Kiểm tra lỗi có phải rate limit / quota hết không */
function isRateLimitError(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status === 403 && body.includes('quota')) return true;
  if (status === 400 && body.includes('rate')) return true;
  return false;
}

export async function callLLM(
  messages: Message[],
  options: CallOptions = {},
): Promise<string> {
  const {
    maxTokens = 1024,
    temperature = 0.7,
    profile = 'fast',
    timeoutMs = TIMEOUT_MS,
    jsonMode = false,
  } = options;
  const attempts = buildAttempts(profile);
  const errors: string[] = [];

  for (const { def, key } of attempts) {
    const huy = new AbortController();
    const dongHo = setTimeout(() => huy.abort(), timeoutMs);

    try {
      const res = await fetch(def.url, {
        method: 'POST',
        signal: huy.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          ...(def.name === 'openrouter'
            ? { 'HTTP-Referer': 'https://garutin.com', 'X-Title': 'GaRutin' }
            : {}),
        },
        body: JSON.stringify({
          model: def.model,
          messages,
          max_tokens: maxTokens,
          temperature,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          // gpt-oss có bước suy luận, và token suy luận TÍNH VÀO max_tokens.
          // Prompt càng nhiều quy tắc thì nó càng suy luận dài rồi hết chỗ cho
          // câu trả lời — đúng cách lệnh cải thiện mô tả sản phẩm đã hỏng.
          // Việc ở đây là điền khuôn JSON, không cần nghĩ sâu.
          ...(def.model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (isRateLimitError(res.status, errText)) {
          markRateLimited(key, errText);
        }
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      const text: string = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) throw new Error('Empty response');

      if (errors.length > 0) {
        console.log(
          `[LLM] ${def.name} ...${key.slice(-6)} succeeded after ${
            errors.length
          } failure(s)`,
        );
      }
      return text;
    } catch (e: any) {
      // AbortError chỉ nói "This operation was aborted", không cho biết vì sao.
      // Ghi rõ ngưỡng để người đọc log biết ngay là chạm thời gian chờ.
      const quaHan = e?.name === 'AbortError' || e?.name === 'TimeoutError';
      if (quaHan) markTimedOut(key);
      const msg = `[LLM] ${def.name} ...${key.slice(-6)} failed: ${
        quaHan ? `quá ${timeoutMs / 1000}s không phản hồi` : e.message
      }`;
      console.warn(msg);
      errors.push(msg);
    } finally {
      clearTimeout(dongHo);
    }
  }

  // Bốn nhà cung cấp cùng trả 404 gần như luôn có một nguyên nhân: model bị khai
  // tử. Nói thẳng ra cách sửa, thay vì để người đọc log tự suy từ bốn thông báo
  // tiếng Anh khác nhau.
  const deuLa404 = errors.length > 0 && errors.every((e) => e.includes('HTTP 404'));
  const goiY = deuLa404
    ? '\n\nTất cả đều 404 — nhiều khả năng tên model đã bị nhà cung cấp khai tử. ' +
      'Đặt lại bằng biến môi trường GROQ_MODEL / GEMINI_MODEL / CEREBRAS_MODEL / ' +
      'OPENROUTER_MODEL rồi khởi động lại, không cần sửa mã.'
    : '';
  throw new Error(`Tất cả AI providers thất bại:\n${errors.join('\n')}${goiY}`);
}
