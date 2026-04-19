// 591 分享短連結（www.591.com.tw/<slug>?salt=...）伺服器端會依 User-Agent 302 跳轉到
// sale.591.com.tw/home/house/detail/... 的完整物件頁。realestate agent 的 zod 校驗只接受
// sale.591.com.tw 格式，所以在 orchestrate 入口先 follow redirect 一次，把短連結展開成
// 完整網址，再交給 planner / agent，避免 agent 直接 400 回絕。

const SHORT_LINK_RE = /https?:\/\/(?:www\.)?591\.com\.tw\/(?!home\/)[^\s]+/gi;
const SALE_LINK_RE = /https?:\/\/sale\.591\.com\.tw\/home\/house\/detail\/[^\s]+/i;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function resolveOne(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA },
    });
    const finalUrl = res.url;
    if (finalUrl && SALE_LINK_RE.test(finalUrl)) return finalUrl;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function expand591ShortLinks(text: string): Promise<string> {
  const matches = Array.from(new Set(text.match(SHORT_LINK_RE) ?? []));
  if (matches.length === 0) return text;

  const resolved = await Promise.all(
    matches.map(async (m) => ({ original: m, final: await resolveOne(m) }))
  );

  let result = text;
  for (const { original, final } of resolved) {
    if (final) {
      result = result.split(original).join(final);
    }
  }
  return result;
}
