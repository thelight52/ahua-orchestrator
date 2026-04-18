import { NextRequest, NextResponse } from 'next/server';
import { PIPELINE_TEMPLATES, instantiateTemplate } from '@/lib/orchestrator/pipelineTemplates';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key: string }> }
) {
  const { key } = await ctx.params;
  const template = PIPELINE_TEMPLATES.find((t) => t.key === key);
  if (!template) {
    return NextResponse.json({ error: `找不到模板: ${key}` }, { status: 404 });
  }
  const body = await req.json() as { input?: Record<string, string> };
  const pipeline = instantiateTemplate(template, body.input ?? {});
  return NextResponse.json({ pipeline });
}
