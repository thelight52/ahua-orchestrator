'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { OrchestrationResult, Task } from '@/lib/types';

const STATUS_LABEL: Record<Task['status'], string> = {
  pending: '等待中',
  running: '執行中',
  done: '完成',
  error: '失敗',
};

const STATUS_COLOR: Record<Task['status'], string> = {
  pending: 'text-gray-400',
  running: 'text-blue-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

const AGENTS = [
  {
    id: 'product',
    name: '商品部',
    icon: '📦',
    description: '商品簡介生成、條碼查詢、批次上傳',
    gradientFrom: 'from-blue-500/50',
    gradientTo: 'to-blue-600/10',
    iconBg: 'bg-blue-500/10',
    btnClass: 'text-blue-400 border-blue-500/30 hover:bg-blue-600/20',
    href: '/agent/product',
  },
  {
    id: 'assistant',
    name: '小助理',
    icon: '💬',
    description: 'LINE 推播通知、訊息回報',
    gradientFrom: 'from-green-500/50',
    gradientTo: 'to-green-600/10',
    iconBg: 'bg-green-500/10',
    btnClass: 'text-green-400 border-green-500/30 hover:bg-green-600/20',
    href: '/agent/assistant',
  },
  {
    id: 'procurement',
    name: '採購部',
    icon: '📋',
    description: '訂貨評估、採購分析、Excel 匯入匯出',
    gradientFrom: 'from-orange-500/50',
    gradientTo: 'to-orange-600/10',
    iconBg: 'bg-orange-500/10',
    btnClass: 'text-orange-400 border-orange-500/30 hover:bg-orange-600/20',
    href: '/agent/procurement',
  },
  {
    id: 'marketing',
    name: '行銷設計部',
    icon: '🎨',
    description: '文案生成、商品圖片、影片腳本製作',
    gradientFrom: 'from-purple-500/50',
    gradientTo: 'to-purple-600/10',
    iconBg: 'bg-purple-500/10',
    btnClass: 'text-purple-400 border-purple-500/30 hover:bg-purple-600/20',
    href: '/agent/marketing',
  },
];

type HealthMap = Record<string, boolean | null>;

export default function Home() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthMap>({});

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        const map: HealthMap = {};
        for (const agent of data.agents ?? []) {
          map[agent.id] = agent.healthy;
        }
        setHealth(map);
      } catch {
        // silent
      }
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
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

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight text-white">GOAT</span>
            <span className="text-xs text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">
              Orchestrator
            </span>
          </div>
          <p className="text-xs text-gray-600 hidden sm:block">AHUA 多 Agent 調度中心</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* 統一指令 */}
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3">統一指令</h2>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <textarea
              className="w-full bg-gray-800 text-gray-100 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 border border-gray-700"
              rows={3}
              placeholder="例：幫我生成 K2505 的商品簡介然後 LINE 通知我"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
              }}
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-gray-600">Ctrl + Enter 送出</span>
              <button
                onClick={handleSubmit}
                disabled={loading || !instruction.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? '阿華思考中...' : '送出指令'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-4 mt-4 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4 mt-4">
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-500 uppercase tracking-widest">阿華回報</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      result.status === 'done'
                        ? 'bg-green-900 text-green-300'
                        : result.status === 'partial'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-red-900 text-red-300'
                    }`}
                  >
                    {result.status === 'done' ? '全部完成' : result.status === 'partial' ? '部分完成' : '失敗'}
                  </span>
                </div>
                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              </div>

              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800">
                  <span className="text-xs text-gray-500 uppercase tracking-widest">
                    子任務 ({result.subtasks.length})
                  </span>
                </div>
                <div className="divide-y divide-gray-800">
                  {result.subtasks.map((task, i) => (
                    <div key={task.taskId} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                              #{i + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-200">
                              {AGENTS.find((a) => a.id === task.to)?.name ?? task.to}
                            </span>
                            <span className="text-xs text-gray-500">→ {task.action}</span>
                          </div>
                          {task.result !== undefined && (
                            <pre className="text-xs text-gray-400 bg-gray-800 rounded p-2 mt-2 overflow-x-auto">
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
                  ))}
                </div>
              </div>

              <p className="text-center text-xs text-gray-700 font-mono">{result.taskId}</p>
            </div>
          )}
        </section>

        {/* Agent 總覽 */}
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Agent 總覽</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AGENTS.map((agent) => {
              const status = health[agent.id];
              return (
                <div
                  key={agent.id}
                  className={`rounded-xl bg-gradient-to-br ${agent.gradientFrom} ${agent.gradientTo} p-px`}
                >
                  <div className="rounded-xl bg-gray-900 p-5 h-full flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl ${agent.iconBg} flex items-center justify-center text-xl shrink-0`}
                        >
                          {agent.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-100">{agent.name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            status === true
                              ? 'bg-green-400'
                              : status === false
                                ? 'bg-red-400'
                                : 'bg-gray-600'
                          }`}
                        />
                        <span className="text-xs text-gray-600">
                          {status === true ? '正常' : status === false ? '離線' : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-auto">
                      <Link
                        href={agent.href}
                        className={`block text-center text-sm font-medium py-2 rounded-lg border transition-colors ${agent.btnClass}`}
                      >
                        進入
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
