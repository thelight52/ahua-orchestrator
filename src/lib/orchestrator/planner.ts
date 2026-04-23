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

可用的 Agent 及其 payload 格式：

1. assistant（小助理）：LINE 通知/報告
   - action: notify | report
   - payload: { "userId": "...", "message": "..." }
   ⚠ notify 必須帶 userId（LINE user id）和 message。userId 若未指定可留空，dispatcher 會自動帶入預設值
   ⚠ 若 notify 有 dependsOn 依賴前面任務，message 只要放「任務主題 / 語氣提示」即可（例如「商品簡介生成完成」），dispatcher 會自動把前面任務的實際結果（如商品簡介全文）整合進 LINE 訊息，不要在這裡寫「請查收」等佔位字

2. product（商品部）：商品簡介生成（GAS Web App）
   - action: product-intro
   - payload: { "products": [{ "barcode": "商品編號", "name": "商品名稱" }] }
   ⚠ payload 必須是 products 陣列，barcode = 商品編號，name = 商品名稱

3. procurement（採購部）：採購評估
   - action: procurement-order | procurement-status
   - payload: { "items": [...] }

4. marketing（行銷設計部）：文案/圖片/影片生成
   - action: generate-copy | generate-image | generate-video
   - payload: { "productName": "...", "style"?: "...", "platform"?: "IG|FB" }

5. realestate（房地產查詢）：591 物件 → foundi.info 實價登錄與地址吻合度查詢
   - action: 591-lookup
   - payload: { "userId": "...", "url": "https://sale.591.com.tw/..." }
   ⚠ 觸發條件：指令含 591 網址（sale.591.com.tw）或提到「實價登錄」「foundi」「地址吻合度」
   ⚠ url 必須是 sale.591.com.tw 物件詳情連結（https://sale.591.com.tw/home/house/detail/...）
   ⚠ 此 agent 會自行 push 兩個結果 URL 給 userId，因此「不要」再串接 assistant notify 任務

回傳格式為 JSON 陣列，每個元素包含：
{
  "to": "agent id",
  "action": "capability name",
  "payload": { ... 依上方格式填寫 },
  "priority": "high|normal|low",
  "dependsOn": [0, 1]  // 可選，依賴第幾個任務（0-indexed）
}

只回傳 JSON 陣列，不要有其他文字、markdown、說明或前言。直接從 [ 開始，以 ] 結束。`;

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

export async function planTasks(instruction: string, userId?: string): Promise<Task[]> {
  const userPrompt = `指令：${instruction}${userId ? `\n使用者 ID：${userId}` : ''}`;
  const rawText = await generateText(SYSTEM_PROMPT, userPrompt, {
    temperature: 0.3,
    maxOutputTokens: 1024,
  });

  // Gemini 有時會在 JSON 前後塞說明文字，抓出第一個 [...] 陣列區塊
  const jsonText = extractJsonArray(rawText);
  let plannerTasks: PlannerTask[];
  try {
    plannerTasks = JSON.parse(jsonText);
  } catch (err) {
    console.error('[planner] JSON 解析失敗。原始回應：', rawText);
    throw new Error(`Planner 回傳非合法 JSON：${err instanceof Error ? err.message : err}`);
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
