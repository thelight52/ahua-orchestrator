import { generateText } from '../ai/geminiClient';
import { Task } from '../types';

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

  const userPrompt = `使用者指令：${instruction}

各子任務執行結果：
${JSON.stringify(taskSummary, null, 2)}

請用繁體中文，簡潔地告訴使用者任務執行的結果。如果有錯誤，說明哪個環節失敗了。`;

  try {
    return await generateText('', userPrompt, { temperature: 0.5, maxOutputTokens: 512 });
  } catch (err) {
    console.warn('[aggregator] AI 失敗，回退預設文字:', err instanceof Error ? err.message : err);
    return '任務執行完成。';
  }
}
