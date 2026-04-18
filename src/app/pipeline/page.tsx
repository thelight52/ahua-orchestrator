'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AGENT_THEMES, AgentId } from '@/lib/ui/agentTheme';
import type { PipelineRun, TaskRun, Pipeline } from '@/lib/orchestrator/pipeline';

interface TemplateSummary {
  key: string;
  name: string;
  description: string;
  inputSchema: { key: string; label: string; placeholder?: string; required?: boolean }[];
  taskCount: number;
}

const STATUS_STYLE: Record<TaskRun['status'], { label: string; color: string; bg: string }> = {
  pending: { label: '等待中', color: 'text-gray-400', bg: 'bg-gray-800' },
  awaiting_confirm: { label: '等待確認', color: 'text-yellow-300', bg: 'bg-yellow-900/60' },
  running: { label: '執行中', color: 'text-blue-300', bg: 'bg-blue-900/60' },
  done: { label: '完成', color: 'text-emerald-300', bg: 'bg-emerald-900/60' },
  error: { label: '失敗', color: 'text-red-300', bg: 'bg-red-900/60' },
  skipped: { label: '已跳過', color: 'text-gray-500', bg: 'bg-gray-800' },
  cancelled: { label: '已取消', color: 'text-gray-500', bg: 'bg-gray-800' },
};

const RUN_STATUS_STYLE: Record<PipelineRun['status'], { label: string; className: string }> = {
  running: { label: '執行中', className: 'bg-blue-900 text-blue-300' },
  awaiting_confirm: { label: '等待確認', className: 'bg-yellow-900 text-yellow-300' },
  done: { label: '全部完成', className: 'bg-emerald-900 text-emerald-300' },
  partial: { label: '部分失敗', className: 'bg-amber-900 text-amber-300' },
  error: { label: '失敗', className: 'bg-red-900 text-red-300' },
  cancelled: { label: '已取消', className: 'bg-gray-800 text-gray-400' },
};

export default function PipelinePage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [input, setInput] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState('');
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualJson, setManualJson] = useState('');
  const [mode, setMode] = useState<'template' | 'manual'>('template');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/pipeline/templates')
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        if (d.templates?.[0]) setSelectedKey(d.templates[0].key);
      })
      .catch(() => {});
  }, []);

  // 輪詢 run 狀態
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!run?.runId) return;
    const terminal: PipelineRun['status'][] = ['done', 'partial', 'error', 'cancelled'];
    if (terminal.includes(run.status) && run.status !== 'awaiting_confirm') {
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/pipeline/${run.runId}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as PipelineRun;
        setRun(data);
        if (terminal.includes(data.status) && data.status !== 'awaiting_confirm') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 1200);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [run?.runId, run?.status]);

  const selectedTemplate = templates.find((t) => t.key === selectedKey);

  async function handleRunTemplate() {
    if (!selectedTemplate || loading) return;
    setLoading(true);
    setError(null);
    setRun(null);
    try {
      // 先用 input 把 template 填成 pipeline
      const inst = await fetch(`/api/pipeline/templates/${selectedKey}/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const instData = await inst.json();
      if (!inst.ok) throw new Error(instData.error ?? '模板實例化失敗');

      const res = await fetch('/api/pipeline/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline: instData.pipeline, userId: userId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '啟動失敗');
      setRun(data.run as PipelineRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : '執行失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunManual() {
    if (!manualJson.trim() || loading) return;
    setLoading(true);
    setError(null);
    setRun(null);
    try {
      let pipeline: Pipeline;
      try {
        pipeline = JSON.parse(manualJson);
      } catch {
        throw new Error('JSON 格式錯誤');
      }
      const res = await fetch('/api/pipeline/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline, userId: userId.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '啟動失敗');
      setRun(data.run as PipelineRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : '執行失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(taskId: number, confirmed: boolean) {
    if (!run) return;
    try {
      const res = await fetch(`/api/pipeline/${run.runId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, confirmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '確認失敗');
      setRun(data.run as PipelineRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : '確認失敗');
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3 transition-colors"
          >
            ← 返回總覽
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-4xl">🕸</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-100">工作流（Pipeline）</h1>
              <p className="text-sm text-gray-500 mt-0.5">DAG 任務編排 · 人工確認 · 自動重試</p>
            </div>
          </div>
        </header>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('template')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${
              mode === 'template' ? 'bg-yellow-500 text-gray-950' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            📋 使用模板
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium ${
              mode === 'manual' ? 'bg-yellow-500 text-gray-950' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            ✏️ 手動建立（JSON）
          </button>
        </div>

        <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 mb-6">
          {mode === 'template' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">選擇模板</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setSelectedKey(t.key)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        selectedKey === t.key
                          ? 'border-yellow-500 bg-yellow-500/10'
                          : 'border-gray-800 bg-gray-950/50 hover:border-gray-700'
                      }`}
                    >
                      <div className="text-sm font-semibold text-gray-100">{t.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{t.description}</div>
                      <div className="text-xs text-gray-600 mt-2">{t.taskCount} 個任務</div>
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <div className="text-xs text-gray-500">（沒有可用模板）</div>
                  )}
                </div>
              </div>

              {selectedTemplate && selectedTemplate.inputSchema.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">輸入參數</label>
                  <div className="space-y-2">
                    {selectedTemplate.inputSchema.map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {f.label}
                          {f.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={input[f.key] ?? ''}
                          onChange={(e) => setInput({ ...input, [f.key]: e.target.value })}
                          placeholder={f.placeholder}
                          className="w-full bg-gray-950 text-gray-100 rounded-lg px-3 py-2 text-sm border border-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  LINE User ID（選填，用於確認推播）
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="留空則使用 DEFAULT_LINE_USER_ID"
                  className="w-full bg-gray-950 text-gray-100 rounded-lg px-3 py-2 text-sm border border-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono"
                />
              </div>

              <button
                onClick={handleRunTemplate}
                disabled={loading || !selectedTemplate}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 font-bold py-2.5 rounded-lg transition-colors"
              >
                {loading ? '啟動中...' : '▶ 啟動 Pipeline'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  Pipeline JSON
                </label>
                <textarea
                  value={manualJson}
                  onChange={(e) => setManualJson(e.target.value)}
                  rows={14}
                  placeholder={`{
  "name": "my-pipeline",
  "tasks": [
    {
      "id": 0,
      "agent": "product",
      "action": "product-intro",
      "payload": { "products": [{ "barcode": "K2505", "name": "..." }] },
      "dependsOn": []
    },
    {
      "id": 1,
      "agent": "assistant",
      "action": "notify",
      "payload": { "message": "{{task[0].result.result.intros[0].title}}" },
      "dependsOn": [0],
      "requireConfirmation": true,
      "confirmMessage": "確認推播到 LINE？"
    }
  ]
}`}
                  className="w-full bg-gray-950 text-gray-100 rounded-lg px-3 py-2 text-xs border border-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  LINE User ID（選填）
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-gray-950 text-gray-100 rounded-lg px-3 py-2 text-sm border border-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono"
                />
              </div>
              <button
                onClick={handleRunManual}
                disabled={loading || !manualJson.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-950 font-bold py-2.5 rounded-lg transition-colors"
              >
                {loading ? '啟動中...' : '▶ 啟動 Pipeline'}
              </button>
            </div>
          )}
        </section>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-4 text-sm">{error}</div>
        )}

        {run && <RunView run={run} onConfirm={handleConfirm} />}
      </div>
    </main>
  );
}

function RunView({ run, onConfirm }: { run: PipelineRun; onConfirm: (id: number, c: boolean) => void }) {
  const style = RUN_STATUS_STYLE[run.status];
  return (
    <section className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-100">{run.pipeline.name}</div>
          <div className="text-xs text-gray-500 font-mono mt-0.5">{run.runId}</div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${style.className}`}>{style.label}</span>
      </div>

      <div className="divide-y divide-gray-800">
        {run.tasks.map((t) => {
          const theme = AGENT_THEMES[t.agent as AgentId];
          const s = STATUS_STYLE[t.status];
          const deps = run.pipeline.tasks.find((pt) => pt.id === t.id)?.dependsOn ?? [];
          return (
            <div key={t.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                      #{t.id}
                    </span>
                    <span className={`text-sm font-medium ${theme?.text ?? 'text-gray-200'}`}>
                      {theme?.emoji} {theme?.name ?? t.agent}
                    </span>
                    <span className="text-xs text-gray-500">→ {t.action}</span>
                    {deps.length > 0 && (
                      <span className="text-xs text-gray-600">依賴 {deps.map((d) => `#${d}`).join(', ')}</span>
                    )}
                    {t.attempts > 1 && (
                      <span className="text-xs text-amber-400">重試 {t.attempts - 1} 次</span>
                    )}
                  </div>

                  {t.status === 'awaiting_confirm' && (
                    <div className="mt-2 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-200 mb-3">
                        🔔 {t.confirmMessage ?? '需要人工確認才能繼續'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onConfirm(t.id, true)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
                        >
                          ✅ 確認
                        </button>
                        <button
                          onClick={() => onConfirm(t.id, false)}
                          className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
                        >
                          ❌ 取消
                        </button>
                      </div>
                    </div>
                  )}

                  {t.result !== undefined && t.status === 'done' && (
                    <pre className="text-xs text-gray-400 bg-gray-950 rounded p-2 mt-2 overflow-x-auto border border-gray-800">
                      {JSON.stringify(t.result, null, 2)}
                    </pre>
                  )}
                  {t.error && t.status !== 'awaiting_confirm' && (
                    <p className="text-xs text-red-400 mt-1">⚠ {t.error}</p>
                  )}
                </div>

                <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded ${s.bg} ${s.color}`}>
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
