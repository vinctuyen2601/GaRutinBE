/**
 * Multi-provider LLM helper with automatic fallback.
 *
 * Supported env vars (add at least one):
 *   GROQ_API_KEY       — groq.com (free tier: ~1000 req/day, 30 req/min)
 *   GEMINI_API_KEY     — aistudio.google.com (free: 15 req/min, 1500 req/day)
 *   CEREBRAS_API_KEY   — inference.cerebras.ai (free tier)
 *   OPENROUTER_API_KEY — openrouter.ai (free models available)
 */

/**
 * Extract JSON từ AI response — xử lý các trường hợp:
 * - Bọc trong ```json ... ```
 * - Có text giải thích trước/sau JSON
 * - JSON nằm giữa văn bản
 */
export function parseJsonFromAI<T = any>(text: string, context?: string): T {
  // 1. Thử parse thẳng
  try {
    return JSON.parse(text.trim());
  } catch {}

  // 2. Bóc markdown code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (codeBlock) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch {}
  }

  // 3. Tìm JSON object đầu tiên trong text
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  // Không parse được — log để debug
  const preview = text.slice(0, 300);
  console.error(`[LLM] JSON parse failed${context ? ` (${context})` : ''}. Response preview:\n${preview}`);
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

interface Provider {
  name: string;
  url: string;
  model: string;
  apiKey: () => string | undefined;
}

const GROQ: Provider = {
  name: 'groq',
  url: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama-3.3-70b-versatile',
  apiKey: () => process.env.GROQ_API_KEY,
};

const GEMINI: Provider = {
  name: 'gemini',
  url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  model: 'gemini-2.0-flash-lite',
  apiKey: () => process.env.GEMINI_API_KEY,
};

const CEREBRAS: Provider = {
  name: 'cerebras',
  url: 'https://api.cerebras.ai/v1/chat/completions',
  model: 'llama-3.3-70b',
  apiKey: () => process.env.CEREBRAS_API_KEY,
};

const OPENROUTER: Provider = {
  name: 'openrouter',
  url: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'google/gemma-3-27b-it:free',
  apiKey: () => process.env.OPENROUTER_API_KEY,
};

const FAST_PROVIDERS: Provider[] = [GROQ, CEREBRAS, GEMINI, OPENROUTER];
const QUALITY_PROVIDERS: Provider[] = [GEMINI, GROQ, CEREBRAS, OPENROUTER];

export async function callLLM(
  messages: Message[],
  options: CallOptions = {},
): Promise<string> {
  const { maxTokens = 1024, temperature = 0.7, profile = 'fast' } = options;
  const providers = profile === 'quality' ? QUALITY_PROVIDERS : FAST_PROVIDERS;
  const errors: string[] = [];

  for (const provider of providers) {
    const apiKey = provider.apiKey();
    if (!apiKey) continue;

    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(provider.name === 'openrouter'
            ? { 'HTTP-Referer': 'https://garutin.com', 'X-Title': 'GaRutin' }
            : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = (await res.json()) as any;
      const text: string = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!text) throw new Error('Empty response');

      if (errors.length > 0) {
        console.log(`[LLM] Provider ${provider.name} succeeded after ${errors.length} failure(s)`);
      }
      return text;
    } catch (e: any) {
      const msg = `[LLM] ${provider.name} failed: ${e.message}`;
      console.warn(msg);
      errors.push(msg);
    }
  }

  throw new Error(`Tất cả AI providers thất bại:\n${errors.join('\n')}`);
}
