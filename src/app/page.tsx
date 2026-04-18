'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { OrchestrationResult, Task } from '@/lib/types';
import { AGENT_THEMES, AGENT_ORDER, AgentId } from '@/lib/ui/agentTheme';

const STATUS_LABEL: Record<Task['status'], string> = {
  pending: '等待中',
  running: '執行中',
  done: '完成',
  error: '失敗',
};

const STATUS_COLOR: Record<Task['status'], string> = {
  pending: 'text-gray-400',
  running: 'text-blue-400',
  done: 'text-emerald-400',
  error: 'text-red-400',
};

interface AgentStatus {
  id: string;
  name: string;
  configured: boolean;
  healthy: boolean | null;
}

export default function Home() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!instruction.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '未知錯誤');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '執行失敗');
    } finally {
      setLoading(false);
    }
  }

  const agentStatusMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* 標題 */}
        <header className="mb-10">
          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
              GOAT
            </h1>
            <span className="text-lg text-gray-400 font-medium">Orchestrator</span>
          </div>
          <p className="text-gray-500 mt-2 text-sm">AHUA 多 Agent 調度中心</p>
        </header>

        {/* 統一指令輸入 */}
        <section className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800 mb-10 backdrop-blur">
          <label className="block text-xs text-gray-500 mb-3 uppercase tracking-widest">
            統一指令（自動分派給合適 Agent）
          </label>
          <textarea
            className="w-full bg-gray-950 text-gray-100 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500 border border-gray-800"
            rows={3}
            placeholder="例：幫我生成 K2505 的商品簡介，完成後用 LINE 通知我"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
            }}
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-gray-600">Ctrl / ⌘ + Enter 送出</span>
            <button
              onClick={handleSubmit}
              disabled={loading || !instruction.trim()}
              className="bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 text-sm font-bold px-6 py-2 rounded-lg transition-colors"
            >
              {loading ? '執行中...' : '送出指令'}
            </button>
          </div>
        </section>

        {/* Agent 卡片總覽 */}
        <section className="mb-10">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">各部門入口</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AGENT_ORDER.map((id) => {
              const theme = AGENT_THEMES[id as AgentId];
              const status = agentStatusMap.get(id);
              const healthy = status?.healthy;
              const statusColor =
                healthy === true
                  ? 'bg-emerald-500'
                  : healthy === false
                    ? 'bg-red-500'
                    : 'bg-gray-500';
              const statusLabel =
                healthy === true ? '正常' : healthy === false ? '離線' : '未檢測';
              return (
                <Link
                  key={id}
                  href={`/agent/${id}`}
                  className={`group relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.bgGradient} p-5 transition-all hover:scale-[1.02] hover:border-gray-600`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{theme.emoji}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${statusColor} ${healthy ? 'animate-pulse' : ''}`} />
                      <span className="text-xs text-gray-500">{statusLabel}</span>
                    </div>
                  </div>
                  <h3 className={`text-lg font-bold ${theme.text} mb-1`}>{theme.name}</h3>
                  <p className="text-sm text-gray-400 mb-3">{theme.description}</p>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    {theme.capabilities}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 group-hover:text-white transition-colors">
                      進入
                    </span>
                    <span className="text-gray-500 group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 結果 */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {result && (
          <section className="space-y-4">
            <div className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-widest">GOAT 回報</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    result.status === 'done'
                      ? 'bg-emerald-900 text-emerald-300'
                      : result.status === 'partial'
                        ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-red-900 text-red-300'
                  }`}
                >
                  {result.status === 'done' ? '全部完成' : result.status === 'partial' ? '部分完成' : '失敗'}
                </span>
              </div>
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                {result.summary}
              </p>
            </div>

            <div className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800">
                <span className="text-xs text-gray-500 uppercase tracking-widest">
                  子任務 ({result.subtasks.length})
                </span>
              </div>
              <div className="divide-y divide-gray-800">
                {result.subtasks.map((task, i) => {
                  const theme = AGENT_THEMES[task.to as AgentId];
                  return (
                    <div key={task.taskId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                              #{i + 1}
                            </span>
                            <span className={`text-sm font-medium ${theme?.text ?? 'text-gray-200'}`}>
                              {theme?.emoji} {theme?.name ?? task.to}
                            </span>
                            <span className="text-xs text-gray-500">→ {task.action}</span>
                          </div>
                          {task.result !== undefined && (
                            <pre className="text-xs text-gray-400 bg-gray-950 rounded p-2 mt-2 overflow-x-auto border border-gray-800">
                              {JSON.stringify(task.result, null, 2)}
                            </pre>
                          )}
                          {task.error && (
                            <p className="text-xs text-red-400 mt-1">{task.error}</p>
                          )}
                        </div>
                        <span className={`text-xs font-medium shrink-0 ${STATUS_COLOR[task.status]}`}>
                          {STATUS_LABEL[task.status]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-xs text-gray-700 font-mono">{result.taskId}</p>
          </section>
        )}
      </div>
    </main>
  );
}
