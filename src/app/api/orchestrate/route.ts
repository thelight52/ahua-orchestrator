import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { planTasks } from '@/lib/orchestrator/planner';
import { dispatchMultiple } from '@/lib/agents/dispatcher';
import { aggregateResults } from '@/lib/orchestrator/aggregator';
import { expand591ShortLinks } from '@/lib/orchestrator/expandUrls';
import { OrchestrationRequest, OrchestrationResult } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body: OrchestrationRequest = await req.json();
    const { instruction: rawInstruction, userId } = body;

    if (!rawInstruction?.trim()) {
      return NextResponse.json({ error: '請輸入指令' }, { status: 400 });
    }

    // 短指令直接回提示，省 token 也避免 Gemini 自由發揮（例如「@GOAT 幫我查」+空白）
    // 條件：trim 後 ≤ 12 字、不含 URL、且只是常見召喚詞片段
    const PROMPT_STUBS = /^(@?GOAT\s*)?(幫我查|查寶雅|幫我生成( 文案| 圖片| 影片)?|幫忙|查一下|看一下)\s*$/;
    const trimmed = rawInstruction.trim();
    if (
      trimmed.length <= 12 &&
      !/https?:\/\//.test(trimmed) &&
      PROMPT_STUBS.test(trimmed)
    ) {
      return NextResponse.json({
        taskId: uuidv4(),
        status: 'prompt',
        subtasks: [],
        summary: '請直接貼上房仲物件網址，或具體描述你要做什麼（例如：「生成 K2505 商品簡介」） 🔍',
      });
    }

    // 先展開 591 分享短連結（www.591.com.tw/XX?salt=...）為 sale.591.com.tw 完整網址，
    // 否則 realestate agent 的 zod 會拒絕，planner 也沒辦法產生正確任務
    const instruction = await expand591ShortLinks(rawInstruction);

    const orchestrationId = uuidv4();

    // 1. 用 Claude 拆解指令為子任務
    const tasks = await planTasks(instruction, userId);

    // 2. 並行分派給各 Agent
    const executedTasks = await dispatchMultiple(tasks);

    // 3. 用 Claude 彙整結果成人話
    const summary = await aggregateResults(instruction, executedTasks);

    const allDone = executedTasks.every((t) => t.status === 'done');
    const anyError = executedTasks.some((t) => t.status === 'error');

    const result: OrchestrationResult = {
      taskId: orchestrationId,
      status: allDone ? 'done' : anyError ? 'partial' : 'done',
      subtasks: executedTasks,
      summary,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[orchestrate] 錯誤:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
