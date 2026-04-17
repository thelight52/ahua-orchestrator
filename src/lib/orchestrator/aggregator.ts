import Anthropic from '@anthropic-ai/sdk';
import { Task } from '../types';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function aggregateResults(
  instruction: string,
  tasks: Task[]
): Promise<string> {
  const taskSummary = tasks.map((t, i) => ({
    index: i,
    to: t.to,
    action: t.action,
    status: t.status,
    result: t.result,
    error: t.error,
  }));

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `使用者指令：${instruction}

各子任務執行結果：
${JSON.stringify(taskSummary, null, 2)}

請用繁體中文，簡潔地告訴使用者任務執行的結果。如果有錯誤，說明哪個環節失敗了。`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    return '任務執行完成。';
  }
  return content.text;
}
