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

⚠ URL 即意圖（最高優先級）：
- 只要訊息中含**任何房仲 URL**（清單見 realestate agent 段落），就**無條件**生成 realestate lookup 任務
- 不要分析 URL 旁邊的中文描述、不要嘗試從文字內容判斷其他 agent
- 不要對使用者反問「你要查什麼」— URL 就是答案

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

5. channel-platform（AI 通路作業平台）：通路銷量／庫存查詢
   - action: sales-query
   - payload: { "keyword": "K2505|商品名|條碼", "month"?: "YYYYMM", "tab"?: "全品銷量總表|A07總表|A04總表|A08總表|A12總表" }
   ⚠ 觸發時機：
     • 「查 寶雅 XXX 銷量」「XXX 上個月賣多少」「XXX 幾月銷量」
     • 「賣最好的襪款」「A07 部門 3 月排行」
     • 不指定通路時預設查寶雅（目前唯一支援的通路）
   ⚠ keyword 必填，可放品名關鍵字、國際條碼、品項條碼，採模糊比對
   ⚠ month 為 YYYYMM 6 碼數字（如 202603）。「上個月」「3 月」需轉換成具體 YYYYMM
   ⚠ 部門分頁：襪類→A07總表、飾品→A04總表、內衣/小可愛→A08總表、零食→A12總表
   ⚠ 此 agent 回傳純資料，若需 LINE 推播結果，再加一個 dependsOn 的 assistant notify 任務

6. realestate（房地產整合器）：8 家房仲物件 → 爬取物件 + 對應 Foundi 實價登錄與地址吻合度查詢
   - action：lookup（統一入口，自動辨識來源房仲）
   - payload: { "userId": "...", "url": "原始完整網址" }
   ⚠ 支援的房仲網址（任一即觸發）：
     • 591：sale.591.com.tw
     • 永慶：buy.yungching.com.tw、ycut.com.tw（短網址）
     • 有巢氏：buy.u-trust.com.tw（買屋主站，永慶集團同 codebase）、ychouse.com.tw、x.ychouse.tw（短網址）
     • 信義：sinyi.com.tw
     • 東森：etwarm.com.tw
     • 台灣房屋：twhg.com.tw
     • 住商不動產：hbhousing.com.tw
     • 中信房屋：cthouse.com.tw
   ⚠ 也可由「實價登錄」「foundi」「地址吻合度」等關鍵字觸發
   ⚠ URL 必須是原始完整連結（含 query string），禁止任何形式的截斷或省略
   ⚠ 若訊息中夾雜其他文字（如業務推薦語），仍以其中的 URL 為主，其他敘述忽略
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

// 房仲網域清單（包含短網址）— 統一給 fast-path 與 fallback 使用
const REALESTATE_HOSTS =
  /sale\.591\.com\.tw|buy\.yungching\.com\.tw|ycut\.com\.tw|ychouse\.com\.tw|x\.ychouse\.tw|u-trust\.com\.tw|sinyi\.com\.tw|etwarm\.com\.tw|twhg\.com\.tw|hbhousing\.com\.tw|cthouse\.com\.tw/;

function extractRealestateUrl(text: string): string | null {
  const m = text.match(/https?:\/\/\S+/);
  if (!m) return null;
  const url = m[0].replace(/[，。、！？「」『』\s]+$/, '');
  return REALESTATE_HOSTS.test(url) ? url : null;
}

// 最後手段：用 regex 從原始回應裡湊出一個 task（至少救下 URL）
function regexFallback(raw: string, instruction: string): PlannerTask[] {
  // 從指令原文抓 URL（比從 Gemini 回應抓更可靠 — 指令就是用戶直接輸入的）
  const url = extractRealestateUrl(instruction);
  if (url) {
    return [{ to: 'realestate', action: 'lookup', payload: { url, userId: '' }, priority: 'high' }];
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
  // Fast-path 1：小助理 Quick Reply 觸發的明確指令（前綴 + URL）
  // 例：foundi-lookup https://... / realprice https://... / address-match https://...
  // 直接帶 action 回去，dispatcher 會把它對應到 /api/agent/lookup 的對應 mode
  const REALESTATE_COMMANDS = ['foundi-lookup', 'realprice', 'address-match', 'import', 'foundi-list', 'notion-save'] as const;
  const trimmedInst = instruction.trim();
  for (const cmd of REALESTATE_COMMANDS) {
    if (trimmedInst.startsWith(cmd + ' ') || trimmedInst === cmd) {
      const url = trimmedInst.slice(cmd.length).trim();
      console.log(`[planner] fast-path: 房仲 Quick Reply 指令 ${cmd}`);
      return [
        createTask({
          from: 'orchestrator',
          to: 'realestate',
          action: cmd,
          payload: { url, userId: userId ?? '' },
          priority: 'high',
        }),
      ];
    }
  }

  // Fast-path 2：訊息裡只要含房仲 URL，直接生成 realestate lookup 任務，跳過 Gemini
  // 原因：Gemini 偶爾會忽略 URL 改去分析旁邊的描述文字。URL 是最強的意圖訊號，
  // regex 命中即視為查物件，比繞 LLM 一圈更可靠也更省 token。
  const realestateUrl = extractRealestateUrl(instruction);
  if (realestateUrl) {
    console.log('[planner] fast-path: 偵測到房仲 URL，跳過 Gemini 直接派 lookup');
    return [
      createTask({
        from: 'orchestrator',
        to: 'realestate',
        action: 'lookup',
        payload: { url: realestateUrl, userId: userId ?? '' },
        priority: 'high',
      }),
    ];
  }

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
