// 統一 AI 呼叫層：Gemini Flash 為主 + Gemma fallback
// 用 REST API（無需額外 SDK 依賴，Next.js/Vercel 環境都吃得動）

// Gemini 3 Flash 目前為 preview；Gemma 4 31B 為 fallback。
// 實際 API 的模型 ID 帶後綴 -preview / -it
const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemma-4-31b-it';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemma 系列不支援 systemInstruction 欄位，需要把 system prompt 併進 user prompt
function isGemma(model: string): boolean {
  return model.startsWith('gemma');
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiPart[];
  role?: string;
}

interface GeminiResponse {
  candidates?: { content?: GeminiContent }[];
  error?: { code: number; message: string; status?: string };
}

// 避免同一執行緒短時間內重複送出「已切 fallback」LINE 通知（冷卻 1 小時）
let lastFallbackNotifyAt = 0;
const FALLBACK_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

async function notifyFallback(from: string, to: string, reason: string): Promise<void> {
  const now = Date.now();
  if (now - lastFallbackNotifyAt < FALLBACK_NOTIFY_COOLDOWN_MS) return;
  lastFallbackNotifyAt = now;

  const baseUrl = process.env.AGENT_ASSISTANT_URL;
  const apiKey = process.env.AGENT_ASSISTANT_KEY;
  const userId = process.env.DEFAULT_LINE_USER_ID;
  if (!baseUrl || !userId) return;

  const message = `⚠️ ${from} 不可用，已自動切換為 ${to}\n\n原因：${reason}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Agent-Key'] = apiKey;

  fetch(`${baseUrl}/api/agent/notify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      taskId: `fallback-${now}`,
      userId,
      message,
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch((err) => {
    console.warn('[geminiClient] fallback 通知失敗:', err instanceof Error ? err.message : err);
  });
}

function isTransientError(status: number): boolean {
  // 429 rate limit / 500 / 503 service unavailable / 504 gateway timeout
  return status === 429 || status === 500 || status === 503 || status === 504;
}

async function callModel(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY 未設定');
  }

  const url = `${ENDPOINT}/${model}:generateContent?key=${apiKey}`;
  // Gemma 不支援 systemInstruction，改把 system 與 user 合併
  const gemma = isGemma(model);
  const mergedUser = gemma && systemPrompt
    ? `${systemPrompt}\n\n---\n\n${userPrompt}`
    : userPrompt;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: mergedUser }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.5,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
    },
  };
  if (!gemma && systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const raw = await res.text();
  let data: GeminiResponse;
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error(`Gemini 非 JSON 回應（status ${res.status}）：${raw.slice(0, 200)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  if (!res.ok || data.error) {
    const code = data.error?.code ?? res.status;
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(`${model} 呼叫失敗（${code}）：${msg}`);
    (err as Error & { status?: number }).status = code;
    throw err;
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  if (!text) {
    throw new Error(`${model} 回傳空內容`);
  }
  return text;
}

// 主要對外 API：自動 fallback
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  try {
    return await callModel(PRIMARY_MODEL, systemPrompt, userPrompt, options);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 0;
    const reason = err instanceof Error ? err.message : String(err);

    // 非短暫錯誤直接拋（例如 400 prompt 格式錯、401 API key 錯）
    if (!isTransientError(status)) {
      throw err;
    }

    console.warn(`[geminiClient] ${PRIMARY_MODEL} 失敗，切換 ${FALLBACK_MODEL}：${reason}`);
    void notifyFallback(PRIMARY_MODEL, FALLBACK_MODEL, reason);

    return await callModel(FALLBACK_MODEL, systemPrompt, userPrompt, options);
  }
}
