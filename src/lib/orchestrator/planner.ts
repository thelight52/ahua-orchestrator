import Anthropic from '@anthropic-ai/sdk';
import { Task, createTask } from '../types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface PlannerTask {
  to: string;
  action: string;
  payload: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  dependsOn?: number[];
}

const SYSTEM_PROMPT = `你是阿華 Orchestrator 的任務拆解器。
你的工作是把使用者的自然語言指令，拆解成給各 Agent 的結構化任務清單。

可用的 Agent：
- assistant（小助理）：capabilities = notify, report, message。用於 LINE 通知、發送報告
- product（商品部）：capabilities = product-intro, product-query, product-update。用於商品簡介生成、商品查詢
- procurement（採購部）：capabilities = procurement-order, procurement-status。用於採購訂單、採購狀態
- marketing（行銷設計部）：capabilities = generate-copy, generate-image, schedule-post。用於文案、圖片生成

回傳格式為 JSON 陣列，每個元素包含：
{
  "to": "agent id",
  "action": "capability name",
  "payload": { ... 相關資料 },
  "priority": "high|normal|low",
  "dependsOn": [0, 1]  // 可選，依賴第幾個任務（0-indexed）
}

只回傳 JSON，不要有其他文字。`;

export async function planTasks(instruction: string, userId?: string): Promise<Task[]> {
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
