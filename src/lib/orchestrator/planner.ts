import Anthropic from '@anthropic-ai/sdk';
import { Task, createTask } from '../types';

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

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
   - action: notify | report | message
   - payload: { "message": "...", "userId"?: "..." }

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

回傳格式為 JSON 陣列，每個元素包含：
{
  "to": "agent id",
  "action": "capability name",
  "payload": { ... 依上方格式填寫 },
  "priority": "high|normal|low",
  "dependsOn": [0, 1]  // 可選，依賴第幾個任務（0-indexed）
}

只回傳 JSON，不要有其他文字。`;

export async function planTasks(instruction: string, userId?: string): Promise<Task[]> {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `指令：${instruction}${userId ? `\n使用者 ID：${userId}` : ''}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Planner 回傳格式錯誤');
  }

  // 清除可能的 markdown code block
  const jsonText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const plannerTasks: PlannerTask[] = JSON.parse(jsonText);

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
