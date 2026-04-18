import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAgent } from '@/lib/agents/registry';
import { dispatchTask } from '@/lib/agents/dispatcher';
import { createTask } from '@/lib/types';

// 直接呼叫指定 Agent（繞過 orchestrator planner）
// body: { action: string, payload: Record<string, unknown> }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await ctx.params;
    const agent = getAgent(agentId);
    if (!agent) {
      return NextResponse.json({ error: `未知 Agent: ${agentId}` }, { status: 404 });
    }
    if (!agent.baseUrl) {
      return NextResponse.json({ error: `Agent "${agent.name}" 未設定 baseUrl` }, { status: 400 });
    }

    const body = await req.json() as {
      action?: string;
      payload?: Record<string, unknown>;
    };

    if (!body.action) {
      return NextResponse.json({ error: '缺少 action' }, { status: 400 });
    }

    const task = createTask({
      from: 'dashboard',
      to: agentId,
      action: body.action,
      payload: body.payload ?? {},
      priority: 'normal',
    });

    const res = await dispatchTask(task);

    return NextResponse.json({
      taskId: task.taskId,
      agent: agentId,
      action: body.action,
      success: res.success,
      data: res.data,
      error: res.error,
    }, { status: res.success ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
