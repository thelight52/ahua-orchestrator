export interface AgentConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  capabilities: string[];
  healthEndpoint: string;
}

// 從環境變數讀取各 Agent 的設定
const agents: AgentConfig[] = [
  {
    id: 'assistant',
    name: '小助理',
    baseUrl: process.env.AGENT_ASSISTANT_URL ?? '',
    apiKey: process.env.AGENT_ASSISTANT_KEY,
    capabilities: ['notify', 'report', 'message'],
    healthEndpoint: '/api/agent/health',
  },
  {
    id: 'product',
    name: '商品部',
    baseUrl: process.env.AGENT_PRODUCT_URL ?? '',
    apiKey: process.env.AGENT_PRODUCT_KEY,
    capabilities: ['product-intro', 'product-query', 'product-update'],
    healthEndpoint: '',  // GAS 沒有 health endpoint
  },
  {
    id: 'procurement',
    name: '採購部',
    baseUrl: process.env.AGENT_PROCUREMENT_URL ?? '',
    apiKey: process.env.AGENT_PROCUREMENT_KEY,
    capabilities: ['procurement-order', 'procurement-status'],
    healthEndpoint: '/api/agent/health',
  },
  {
    id: 'marketing',
    name: '行銷設計部',
    baseUrl: process.env.AGENT_MARKETING_URL ?? '',
    apiKey: process.env.AGENT_MARKETING_KEY,
    capabilities: ['generate-copy', 'generate-image', 'schedule-post'],
    healthEndpoint: '/api/agent/health',
  },
  {
    id: 'realestate',
    name: '房地產整合器',
    baseUrl: process.env.AGENT_REALESTATE_URL ?? '',
    apiKey: process.env.AGENT_REALESTATE_KEY,
    capabilities: ['591-lookup', 'yungching-lookup'],
    healthEndpoint: '/api/agent/health',
  },
];

export function getAgent(id: string): AgentConfig | undefined {
  return agents.find((a) => a.id === id);
}

export function getAllAgents(): AgentConfig[] {
  return agents;
}

export function findAgentByCapability(capability: string): AgentConfig | undefined {
  return agents.find((a) => a.capabilities.includes(capability));
}
