import { NextResponse } from 'next/server';
import { getAllAgents } from '@/lib/agents/registry';
import { checkHealth } from '@/lib/agents/dispatcher';

export async function GET() {
  const agents = getAllAgents();

  const agentStatuses = await Promise.all(
    agents.map(async (agent) => {
      const healthy = agent.healthEndpoint ? await checkHealth(agent.id) : null;
      return {
        id: agent.id,
        name: agent.name,
        configured: !!agent.baseUrl,
        healthy,
      };
    })
  );

  return NextResponse.json({
    status: 'ok',
    orchestrator: 'ahua-orchestrator',
    timestamp: new Date().toISOString(),
    agents: agentStatuses,
  });
}
