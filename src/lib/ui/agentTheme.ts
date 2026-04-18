// 各 Agent 的視覺配色與 metadata（前後端共用）
export type AgentId = 'product' | 'assistant' | 'procurement' | 'marketing';

export interface AgentTheme {
  id: AgentId;
  name: string;
  emoji: string;
  description: string;
  capabilities: string;
  accent: string; // Tailwind 色系名稱
  bgGradient: string;
  border: string;
  button: string;
  buttonHover: string;
  ring: string;
  text: string;
}

export const AGENT_THEMES: Record<AgentId, AgentTheme> = {
  product: {
    id: 'product',
    name: '商品部',
    emoji: '📦',
    description: '商品簡介一鍵生成',
    capabilities: '商品簡介、標籤、描述',
    accent: 'blue',
    bgGradient: 'from-blue-900/40 to-blue-950/20',
    border: 'border-blue-800/60',
    button: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-500',
    ring: 'focus:ring-blue-600',
    text: 'text-blue-300',
  },
  assistant: {
    id: 'assistant',
    name: '小助理',
    emoji: '💬',
    description: 'LINE 推播與通知',
    capabilities: 'LINE 通知、報告推送',
    accent: 'green',
    bgGradient: 'from-emerald-900/40 to-emerald-950/20',
    border: 'border-emerald-800/60',
    button: 'bg-emerald-600',
    buttonHover: 'hover:bg-emerald-500',
    ring: 'focus:ring-emerald-600',
    text: 'text-emerald-300',
  },
  procurement: {
    id: 'procurement',
    name: '採購部',
    emoji: '📊',
    description: '訂貨評估與採購清單',
    capabilities: '訂貨評估、採購狀態',
    accent: 'orange',
    bgGradient: 'from-orange-900/40 to-orange-950/20',
    border: 'border-orange-800/60',
    button: 'bg-orange-600',
    buttonHover: 'hover:bg-orange-500',
    ring: 'focus:ring-orange-600',
    text: 'text-orange-300',
  },
  marketing: {
    id: 'marketing',
    name: '行銷設計部',
    emoji: '🎨',
    description: '文案／圖片／影片生成',
    capabilities: '生成文案、實穿照、影片腳本',
    accent: 'purple',
    bgGradient: 'from-purple-900/40 to-purple-950/20',
    border: 'border-purple-800/60',
    button: 'bg-purple-600',
    buttonHover: 'hover:bg-purple-500',
    ring: 'focus:ring-purple-600',
    text: 'text-purple-300',
  },
};

export const AGENT_ORDER: AgentId[] = ['product', 'assistant', 'procurement', 'marketing'];
