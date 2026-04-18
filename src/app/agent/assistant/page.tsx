'use client';

import { useState } from 'react';
import AgentHeader from '@/components/AgentHeader';
import { AGENT_THEMES } from '@/lib/ui/agentTheme';

export default function AssistantAgentPage() {
  const theme = AGENT_THEMES.assistant;
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSend() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setStatus(null);
    try {
      const payload: Record<string, string> = { message: message.trim() };
      if (userId.trim()) payload.userId = userId.trim();

      const res = await fetch('/api/agent/assistant/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify', payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? '推播失敗');
      const msgId = data.data?.result?.messageId ?? '';
      setStatus({ ok: true, text: `已推播${msgId ? `（messageId: ${msgId}）` : ''}` });
      setMessage('');
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : '推播失敗' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <AgentHeader theme={theme} />

        <section className={`bg-gradient-to-br ${theme.bgGradient} border ${theme.border} rounded-2xl p-6 mb-6`}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                LINE User ID（留空用預設）
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Uxxxxxxxxxx（留空則送給管理員）"
                className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring} font-mono`}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                訊息內容 *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="輸入要推播到 LINE 的訊息..."
                className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-3 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring} resize-none`}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">
                {message.length} 字
              </span>
              <button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className={`${theme.button} ${theme.buttonHover} disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-6 py-2.5 rounded-lg transition-colors`}
              >
                {loading ? '推播中...' : '💬 推播到 LINE'}
              </button>
            </div>
          </div>
        </section>

        {status && (
          <div
            className={`rounded-xl p-4 text-sm border ${
              status.ok
                ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
                : 'bg-red-900/30 border-red-700 text-red-300'
            }`}
          >
            {status.ok ? '✅' : '❌'} {status.text}
          </div>
        )}
      </div>
    </main>
  );
}
