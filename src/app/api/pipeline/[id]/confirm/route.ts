import { NextRequest, NextResponse } from 'next/server';
import { advanceRun, applyConfirmation, TaskRun } from '@/lib/orchestrator/pipeline';
import { getRun, saveRun } from '@/lib/orchestrator/pipelineStore';
import { dispatchTask } from '@/lib/agents/dispatcher';
import { createTask } from '@/lib/types';

// POST body: { taskId: number, confirmed: boolean }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json() as { taskId?: number; confirmed?: boolean };
    if (typeof body.taskId !== 'number' || typeof body.confirmed !== 'boolean') {
      return NextResponse.json({ error: '缺少 taskId 或 confirmed' }, { status: 400 });
    }

    const run = getRun(id);
    if (!run) {
      return NextResponse.json({ error: `找不到 run: ${id}` }, { status: 404 });
    }

    applyConfirmation(run, body.taskId, body.confirmed);
    saveRun(run);

    const onTaskUpdate = async (t: TaskRun) => {
      saveRun(run);
      if (t.status === 'awaiting_confirm' && run.userId && t.confirmMessage) {
        const notifyTask = createTask({
          from: 'pipeline',
          to: 'assistant',
          action: 'notify',
          payload: {
            userId: run.userId,
            message: `🔔 ${t.confirmMessage}\n\nRun ID: ${run.runId.slice(0, 8)}`,
            quickReply: [
              { label: '✅ 確認', text: `pipeline-confirm ${run.runId} ${t.id} yes` },
              { label: '❌ 取消', text: `pipeline-confirm ${run.runId} ${t.id} no` },
            ],
          },
          priority: 'high',
        });
        try {
          await dispatchTask(notifyTask);
        } catch {}
      }
    };

    // 繼續背景執行後續 task
    if (body.confirmed) {
      advanceRun(run, onTaskUpdate).then(() => saveRun(run)).catch((e) => {
        console.error('[pipeline/confirm] advance error:', e);
        saveRun(run);
      });
    } else {
      // 取消也要 advance 一次讓其他依賴它的 task skip
      advanceRun(run, onTaskUpdate).then(() => saveRun(run));
    }

    return NextResponse.json({ ok: true, run });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
