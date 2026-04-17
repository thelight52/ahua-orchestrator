import Anthropic from '@anthropic-ai/sdk';
import { Task } from '../types';

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// 把依賴任務的 result 串成 LINE 通知訊息（繁中、含完整內容、可直接讀）
export async function composeNotificationMessage(
  notifyTask: Task,
  dependencyTasks: Task[]
): Promise<string> {
  const originalMessage = (notifyTask.payload.message as string) ?? '';

  const depSummary = dependencyTasks.map((t) => ({
    agent: t.to,
    action: t.action,
    status: t.status,
    result: t.result,
    error: t.error,
  }));

  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `你要為 LINE 使用者整理一則通知訊息。要求：
- 繁體中文
- 直接把下方「子任務實際產出的內容」完整呈現給使用者（例如商品簡介的 title、description、highlights 都要放進去）
- 格式要易讀（用 emoji 標題 + 換行分段），不要用 markdown 的 ** 粗體或 ## 標題（LINE 不支援）
- 不要加「以下是結果」「請查收」這種廢話開場
- 不要加結尾廢話（例如「如需進一步幫助...」）

使用者原本的通知提示（僅供參考語氣）：
${originalMessage || '（無）'}

子任務實際產出的內容：
${JSON.stringify(depSummary, null, 2)}

請直接輸出 LINE 訊息內容，不要加引號、不要加說明。`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') return originalMessage;
  return content.text.trim();
}
