import { generateText } from '../ai/geminiClient';
import { Task, createTask } from '../types';

interface PlannerTask {
  to: string;
  action: string;
  payload: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  dependsOn?: number[];
}

const SYSTEM_PROMPT = `你是阿華 Orchestrator 的任務拆解器。
你的工作是把使用者的自然語言指令，拆解成給各 Agent 的結構化任務清單。

⚠ 輸出鐵則（最高優先級）：
- 只輸出一個 JSON 陣列，從 [ 開始到 ] 結束
- 絕對不要有 markdown code fence（不要用 \`\`\`json）、不要有任何說明文字、前言或結語
- 所有 URL 必須「完整、原封不動」地放進 payload — 禁止截斷、省略、加 ...

可用的 Agent 及其 payload 格式：

1. assistant（小助理）：LINE 通知/報告
   - action: notify | report
   - payload: { "userId": "...", "message": "..." }
   ⚠ notify 必須帶 userId 和 message。userId 若未指定可留空，dispatcher 會自動帶入預設值
   ⚠ 若 notify 有 dependsOn 依賴前面任務，message 只要放「任務主題 / 語氣提示」即可，dispatcher 會自動把前面任務的實際結果整合進 LINE 訊息

2. product（商品部）：商品簡介生成（GAS Web App）
   - action: product-intro
   - payload: { "products": [{ "barcode": "商品編號", "name": "商品名稱" }] }

3. procurement（採購部）：採購評估
   - action: procurement-order | procurement-status
   - payload: { "items": [...] }

4. marketing（行銷設計部）：文案/圖片/影片生成
   - action: generate-copy | generate-image | generate-video
   - payload: { "productName": "...", "style"?: "...", "platform"?: "IG|FB" }

5. realestate（房地產整合器）：591 或永慶物件 → 爬取物件 + 對應 Foundi 實價登錄與地址吻合度查詢
   - action：591-lookup（591 網址時用）或 yungching-lookup（永慶網址時用）
   - payload: { "userId": "...", "url": "原始完整網址" }
   ⚠ 觸發條件：指令含 591 或永慶網址（sale.591.com.tw / buy.yungching.com.tw）或提到「實價登錄」「foundi」「地址吻合度」
   ⚠ URL 必須是原始完整連結（含 query string），禁止任何形式的截斷或省略
   ⚠ 若訊息中夾雜其他文字（如永慶業務推薦語），仍以其中的 URL 為主，其他敘述忽略
   ⚠ 此 agent 會自行 push 結果給 userId，不要再串接 assistant notify 任務

回傳格式，每個元素：
{"to":"agent id","action":"capability name","payload":{...},"priority":"high|normal|low","dependsOn":[]}

再次強調：只輸出 [ ... ]，沒有其他任何字元。`;

// 從可能夾雜說明文字 / markdown fence 的回應中擷取 JSON 陣列
function extractJsonArray(raw: string): string {
  let s = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  const first = s.indexOf('[');
  const last = s.lastIndexOf(']');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

// 常見 JSON 截斷修復：補上 unterminated string 的 " 與缺失的 } 、 ]
// 專治 Gemini 輸出超過 maxOutputTokens 被硬截的情況
function tryRepairTruncatedJson(raw: string): string {
  let s = raw.trim();

  // 從 [ 開始到結尾，逐字元掃描追蹤上下文
  let inString = false;
  let escape = false;
  let depthObj = 0; // {
  let depthArr = 0; // [

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depthObj++;
    else if (ch === '}') depthObj--;
    else if (ch === '[') depthArr++;
    else if (ch === ']') depthArr--;
  }

  // 1. 如果停在字串中，補一個 "
  if (inString) s += '"';
  // 2. 補上所有未關閉的 {
  while (depthObj > 0) {
    s += '}';
    depthObj--;
  }
  // 3. 補上所有未關閉的 [
  while (depthArr > 0) {
    s += ']';
    depthArr--;
  }
  return s;
}

// 最後手段：用 regex 從原始回應裡湊出一個 task（至少救下 URL）
function regexFallback(raw: string, instruction: string): PlannerTask[] {
  // 從指令原文抓 URL（比從 Gemini 回應抓更可靠 — 指令就是用戶直接輸入的）
  const urlMatch = instruction.match(/https?:\/\/\S+/);
  if (urlMatch) {
    const url = urlMatch[0].replace(/[，。、\s]+$/, ''); // 去掉中文標點尾綴
    if (/sale\.591\.com\.tw|buy\.yungching\.com\.tw/.test(url)) {
      return [
        {
          to: 'realestate',
          action: '591-lookup',
          payload: { url, userId: '' },
          priority: 'high',
        },
      ];
    }
  }

  // 從 raw 回應抓 agent/action（容錯解析）
  const agentMatch = raw.match(/"to"\s*:\s*"([^"]+)"/);
  const actionMatch = raw.match(/"action"\s*:\s*"([^"]+)"/);
  if (agentMatch && actionMatch) {
    return [
      {
        to: agentMatch[1],
        action: actionMatch[1],
        payload: {},
        priority: 'normal',
      },
    ];
  }

  return [];
}

export async function planTasks(instruction: string, userId?: string): Promise<Task[]> {
  const userPrompt = `指令：${instruction}${userId ? `\n使用者 ID：${userId}` : ''}`;
  const rawText = await generateText(SYSTEM_PROMPT, userPrompt, {
    temperature: 0.2, // 降低溫度讓 JSON 更穩定
    maxOutputTokens: 2048, // 拉高避免被截斷
  });

  // 1. 擷取 [...] 區塊
  const jsonText = extractJsonArray(rawText);

  // 2. 先嘗試直接 parse
  let plannerTasks: PlannerTask[] | null = null;
  try {
    plannerTasks = JSON.parse(jsonText);
  } catch {
    // 3. 嘗試修復截斷的 JSON（補 " } ]）
    try {
      const repaired = tryRepairTruncatedJson(jsonText);
      plannerTasks = JSON.parse(repaired);
      console.warn('[planner] JSON 被截斷，已自動修復');
    } catch {
      // 4. 最後手段：regex 湊一個 task（從原指令抓 URL）
      const fallback = regexFallback(rawText, instruction);
      if (fallback.length > 0) {
        plannerTasks = fallback;
        console.warn('[planner] JSON 解析完全失敗，改用 regex fallback');
      }
    }
  }

  if (!plannerTasks) {
    console.error('[planner] JSON 解析失敗且無法 fallback。原始回應：', rawText);
    throw new Error('Planner 無法產生合法任務清單');
  }

  return plannerTasks.map((pt) =>
    createTask({
      from: 'orchestrator',
      to: pt.to,
      action: pt.action,
      payload: pt.payload,
      priority: pt.priority ?? 'normal',
      dependsOn: pt.dependsOn,
    })
  );
}
