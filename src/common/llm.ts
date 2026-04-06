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
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
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
    try { return JSON.parse(candidate); } catch {}
    // Thử sau khi fix newlines bên trong strings
    try { return JSON.parse(fixJsonStringNewlines(candidate)); } catch {}
  }

  // Không parse được — log để debug
  console.error(`[LLM] JSON parse failed${context ? ` (${context})` : ''}. Response preview:\n${text.slice(0, 400)}`);
  throw new Error('AI trả về dữ liệu không hợp lệ, vui lòng thử lại');
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type LLMProfile = 'fast' | 'quality';

interface CallOptions {
  maxTokens?: number;
  temperature?: number;
  profile?: LLMProfile;
}

interface ProviderDef {
  name: string;
  url: string;
  model: string;
  envKey: string;
}

// Cooldown tracking: key → timestamp khi hết cooldown
const rateLimitCooldown = new Map<string, number>();
const COOLDOWN_MS = 60_000; // 60 giây

function isRateLimited(key: string): boolean {
  const until = rateLimitCooldown.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    rateLimitCooldown.delete(key);
    return false;
  }
  return true;
}

function markRateLimited(key: string): void {
  rateLimitCooldown.set(key, Date.now() + COOLDOWN_MS);
  console.warn(`[LLM] Key ...${key.slice(-6)} rate-limited, cooldown ${COOLDOWN_MS / 1000}s`);
}

/** Parse comma-separated keys từ env var, lọc bỏ empty */
function parseKeys(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue.split(',').map((k) => k.trim()).filter(Boolean);
}

const PROVIDER_DEFS: ProviderDef[] = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    envKey: 'GROQ_API_KEY',
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash-lite',
    envKey: 'GEMINI_API_KEY',
  },
  {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b',
    envKey: 'CEREBRAS_API_KEY',
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemma-3-27b-it:free',
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
  const { maxTokens = 1024, temperature = 0.7, profile = 'fast' } = options;
  const attempts = buildAttempts(profile);
  const errors: string[] = [];

  for (const { def, key } of attempts) {
    try {
      const res = await fetch(def.url, {
        method: 'POST',
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
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (isRateLimitError(res.status, errText)) {
          markRateLimited(key);
        }
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      const text: string = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) throw new Error('Empty response');

      if (errors.length > 0) {
        console.log(`[LLM] ${def.name} ...${key.slice(-6)} succeeded after ${errors.length} failure(s)`);
      }
      return text;
    } catch (e: any) {
      const msg = `[LLM] ${def.name} ...${key.slice(-6)} failed: ${e.message}`;
      console.warn(msg);
      errors.push(msg);
    }
  }

  throw new Error(`Tất cả AI providers thất bại:\n${errors.join('\n')}`);
}
