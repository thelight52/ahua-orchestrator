import { NextRequest, NextResponse } from 'next/server';
import { createTask } from '@/lib/types';
import { dispatchTask } from '@/lib/agents/dispatcher';
import { getAgent } from '@/lib/agents/registry';

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const agent = getAgent(agentId);

  if (!agent) {
    return NextResponse.json({ error: `未知的 Agent: ${agentId}` }, { status: 404 });
  }

  try {
    let action: string;
    let payload: Record<string, unknown>;

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      action = (formData.get('action') as string) || 'evaluate';
      const file = formData.get('file');
      payload = {
        fileName: file instanceof File ? file.name : undefined,
        fileSize: file instanceof File ? file.size : undefined,
      };
    } else {
      const body = await req.json();
      action = body.action;
      payload = body.payload ?? {};
    }

    if (!action) {
      return NextResponse.json({ error: '請提供 action' }, { status: 400 });
    }

    const task = createTask({
      from: 'orchestrator',
      to: agentId,
      action,
      payload,
      priority: 'normal',
    });

    const result = await dispatchTask(task);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
