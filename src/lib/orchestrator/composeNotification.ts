import { generateText } from '../ai/geminiClient';
import { Task } from '../types';

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

  const userPrompt = `你要為 LINE 使用者整理一則通知訊息。要求：
- 繁體中文
- 直接把下方「子任務實際產出的內容」完整呈現給使用者（例如商品簡介的 title、description、highlights 都要放進去）
- 格式要易讀（用 emoji 標題 + 換行分段），不要用 markdown 的 ** 粗體或 ## 標題（LINE 不支援）
- 不要加「以下是結果」「請查收」這種廢話開場
- 不要加結尾廢話（例如「如需進一步幫助...」）

使用者原本的通知提示（僅供參考語氣）：
${originalMessage || '（無）'}

子任務實際產出的內容：
${JSON.stringify(depSummary, null, 2)}

請直接輸出 LINE 訊息內容，不要加引號、不要加說明。`;

  try {
    const text = await generateText('', userPrompt, { temperature: 0.5, maxOutputTokens: 1024 });
    return text.trim() || originalMessage;
  } catch (err) {
    console.warn('[composeNotification] AI 失敗，回退原始訊息:', err instanceof Error ? err.message : err);
    return originalMessage;
  }
}
