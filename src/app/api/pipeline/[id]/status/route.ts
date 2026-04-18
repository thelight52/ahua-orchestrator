import { NextResponse } from 'next/server';
import { getRun } from '@/lib/orchestrator/pipelineStore';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const run = getRun(id);
  if (!run) {
    return NextResponse.json({ error: `找不到 run: ${id}` }, { status: 404 });
  }
  return NextResponse.json(run);
}
