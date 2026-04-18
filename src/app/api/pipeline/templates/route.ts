import { NextResponse } from 'next/server';
import { PIPELINE_TEMPLATES } from '@/lib/orchestrator/pipelineTemplates';

// 列出所有可用的 Pipeline 模板
export async function GET() {
  return NextResponse.json({
    templates: PIPELINE_TEMPLATES.map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema ?? [],
      taskCount: t.pipeline.tasks.length,
    })),
  });
}
