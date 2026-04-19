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
