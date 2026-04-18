'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import AgentHeader from '@/components/AgentHeader';
import { AGENT_THEMES } from '@/lib/ui/agentTheme';

type OrderMode = 30 | 45;

interface EvalRow {
  productId?: string;
  name?: string;
  mainStock?: number;
  suggestion?: string; // 必須訂貨 / 建議訂貨 / 不訂
  orderQty?: number;
  reason?: string;
  [key: string]: unknown;
}

interface EvalResponse {
  taskId: string;
  status: string;
  result?: {
    summary?: { mustOrder: number; suggest: number; skip: number };
    rows?: EvalRow[];
  };
}

function extractError(err: unknown, fallback = '執行失敗'): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

function badgeClass(suggestion?: string): string {
  if (!suggestion) return 'bg-gray-800 text-gray-400';
  if (suggestion.includes('必須')) return 'bg-red-900/60 text-red-300 border border-red-800';
  if (suggestion.includes('建議')) return 'bg-amber-900/60 text-amber-300 border border-amber-800';
  return 'bg-gray-800 text-gray-400 border border-gray-700';
}

export default function ProcurementAgentPage() {
  const theme = AGENT_THEMES.procurement;

  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [orderMode, setOrderMode] = useState<OrderMode>(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvalResponse | null>(null);
  const [offline, setOffline] = useState(false);

  async function handleFile(f: File | null) {
    setFile(f);
    setItems([]);
    setResult(null);
    setError(null);
    if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      setItems(json);
    } catch (err) {
      setError(`Excel 解析失敗：${extractError(err)}`);
    }
  }

  async function handleEvaluate() {
    if (items.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setOffline(false);
    try {
      const res = await fetch('/api/agent/procurement/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'evaluate',
          payload: { items, orderMode },
        }),
      });
      const raw = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error('非 JSON 回應');
      }
      if (!res.ok || data.success === false) {
        const msg = String(data.error ?? '');
        // fetch failed 或 ECONNREFUSED → 採購部離線
        if (/fetch failed|ECONNREFUSED|network|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
          setOffline(true);
          throw new Error('採購部目前離線（本機啟動 api_server.py 後即可使用）');
        }
        throw new Error(msg || `HTTP ${res.status}`);
      }
      setResult(data.data as EvalResponse);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!result?.result?.rows?.length) return;
    const rows = result.result.rows;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '評估結果');
    const fname = `訂貨評估_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fname);
  }

  const summary = result?.result?.summary;
  const rows = result?.result?.rows ?? [];

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <AgentHeader theme={theme} />

        <section className={`bg-gradient-to-br ${theme.bgGradient} border ${theme.border} rounded-2xl p-6 mb-6`}>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">訂貨評估</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                上傳 Excel 檔案
              </label>
              <label
                className={`flex flex-col items-center justify-center gap-2 bg-gray-950/70 border-2 border-dashed ${theme.border} rounded-xl p-8 cursor-pointer hover:border-orange-600 transition-colors`}
              >
                <span className="text-4xl">📄</span>
                <span className="text-sm text-gray-400">
                  {file ? file.name : '點擊選擇 .xlsx 檔案（主倉庫存）'}
                </span>
                {items.length > 0 && (
                  <span className="text-xs text-emerald-400">
                    已解析 {items.length} 筆資料
                  </span>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                訂貨模式
              </label>
              <div className="flex gap-2">
                {([30, 45] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setOrderMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                      orderMode === m
                        ? `${theme.button} text-white`
                        : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                    }`}
                  >
                    {m} 天模式
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={loading || items.length === 0}
              className={`w-full ${theme.button} ${theme.buttonHover} disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors`}
            >
              {loading ? '評估中...' : '🧮 執行訂貨評估'}
            </button>
          </div>
        </section>

        {offline && (
          <div className="bg-amber-900/30 border border-amber-700 text-amber-300 rounded-xl p-4 mb-4 text-sm">
            ⚠️ 採購部目前離線（本機啟動 <code className="bg-black/40 px-1.5 py-0.5 rounded">api_server.py</code> 後可用）。
            請到 <code className="bg-black/40 px-1.5 py-0.5 rounded">AI韓國襪採購助手</code> 目錄執行{' '}
            <code className="bg-black/40 px-1.5 py-0.5 rounded">python api_server.py</code>。
          </div>
        )}

        {error && !offline && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-4 text-sm">{error}</div>
        )}

        {result && (
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider">評估結果</span>
                {summary && (
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-300">
                      必須 {summary.mustOrder}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300">
                      建議 {summary.suggest}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                      不訂 {summary.skip}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={handleExport}
                disabled={rows.length === 0}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                📥 匯出 Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-950/50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">商品</th>
                    <th className="px-4 py-2 text-right">主倉庫存</th>
                    <th className="px-4 py-2 text-center">建議</th>
                    <th className="px-4 py-2 text-right">訂貨量</th>
                    <th className="px-4 py-2 text-left">原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-900/40">
                      <td className="px-4 py-2 text-gray-200">
                        <div className="font-medium">{row.productId ?? '—'}</div>
                        {row.name && <div className="text-xs text-gray-500 mt-0.5">{String(row.name)}</div>}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-300 font-mono">
                        {row.mainStock ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${badgeClass(row.suggestion)}`}>
                          {row.suggestion ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-200 font-mono">
                        {row.orderQty ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">{row.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
