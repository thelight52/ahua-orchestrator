'use client';

import { useState } from 'react';
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

const AGENT_NAME: Record<string, string> = {
  assistant: '小助理',
  product: '商品部',
  procurement: '採購部',
  marketing: '行銷設計部',
  orchestrator: '阿華',
};

export default function Home() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">阿華 Orchestrator</h1>
          <p className="text-gray-400 mt-1 text-sm">AHUA 多 Agent 調度中心</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
          <label className="block text-xs text-gray-500 mb-2 uppercase tracking-widest">
            下達指令
          </label>
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
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {loading ? '執行中...' : '送出指令'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
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
                            {AGENT_NAME[task.to] ?? task.to}
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
      </div>
    </main>
  );
}
