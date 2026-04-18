import { NextRequest, NextResponse } from 'next/server';
import {
  Pipeline,
  validatePipeline,
  createPipelineRun,
  advanceRun,
  TaskRun,
} from '@/lib/orchestrator/pipeline';
import { saveRun } from '@/lib/orchestrator/pipelineStore';
import { dispatchTask } from '@/lib/agents/dispatcher';
import { createTask } from '@/lib/types';

// 啟動一個 pipeline run。立即回傳 runId，背景繼續執行。
// body: { pipeline: Pipeline, userId?: string, sync?: boolean }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { pipeline?: Pipeline; userId?: string; sync?: boolean };
    if (!body.pipeline) {
      return NextResponse.json({ error: '缺少 pipeline' }, { status: 400 });
    }
    const err = validatePipeline(body.pipeline);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const run = createPipelineRun(body.pipeline, body.userId);
    saveRun(run);

    // 當 task 停在 awaiting_confirm 時，透過 LINE 推播確認訊息（若 userId 有設）
    const onTaskUpdate = async (t: TaskRun) => {
      saveRun(run); // 每次更新都存回去
      if (t.status === 'awaiting_confirm' && run.userId && t.confirmMessage) {
        // 呼叫小助理 notify with quickReply
        const confirmUrl = `/api/pipeline/${run.runId}/confirm`;
        const notifyTask = createTask({
          from: 'pipeline',
          to: 'assistant',
          action: 'notify',
          payload: {
            userId: run.userId,
            message: `🔔 ${t.confirmMessage}\n\n回覆「確認」繼續，回覆「取消」中止。\nRun ID: ${run.runId.slice(0, 8)}`,
            quickReply: [
              { label: '✅ 確認', text: `pipeline-confirm ${run.runId} ${t.id} yes` },
              { label: '❌ 取消', text: `pipeline-confirm ${run.runId} ${t.id} no` },
            ],
            _confirmUrl: confirmUrl, // 備註：Dashboard 也可直接打這個 API
          },
          priority: 'high',
        });
        try {
          await dispatchTask(notifyTask);
        } catch {
          // 推播失敗不影響 pipeline（使用者仍可從 Dashboard 確認）
        }
      }
    };

    if (body.sync) {
      // 同步模式：等待 run 結束（或等到 awaiting_confirm）才回傳
      await advanceRun(run, onTaskUpdate);
      saveRun(run);
      return NextResponse.json({ runId: run.runId, run });
    }

    // 非同步：背景跑 advanceRun，立即回傳
    advanceRun(run, onTaskUpdate).then(() => saveRun(run)).catch((e) => {
      console.error('[pipeline/execute] advance error:', e);
      saveRun(run);
    });

    return NextResponse.json({ runId: run.runId, run });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
