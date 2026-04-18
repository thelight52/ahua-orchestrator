'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

interface EvalRow {
  [key: string]: unknown;
}

export default function ProcurementPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EvalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setResults(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setResults(null);
      setError(null);
    }
  }

  async function handleEvaluate() {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', 'evaluate');

      const res = await fetch('/api/agent/procurement/invoke', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '執行失敗');
      setResults(Array.isArray(data.data) ? data.data : [data.data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '執行失敗');
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    if (!results) return;
    const csv = [
      Object.keys(results[0]).join(','),
      ...results.map((r) => Object.values(r).map(String).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '訂貨評估結果.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← 返回
          </Link>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xl">📋</span>
          <span className="font-semibold text-white">採購部</span>
          <span className="text-xs text-gray-600 border border-gray-700 px-2 py-0.5 rounded-full">
            MVP
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-orange-500/30 to-orange-600/5 p-px">
          <div className="rounded-xl bg-gray-900 p-6 space-y-5">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-3">
                上傳訂單 Excel
              </label>
              <div
                className="border-2 border-dashed border-gray-700 rounded-xl p-10 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {file ? (
                  <div>
                    <p className="text-3xl mb-2">📊</p>
                    <p className="text-orange-400 font-medium">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    <p className="text-xs text-gray-600 mt-2">點擊重新選擇</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-3">📊</p>
                    <p className="text-gray-400 text-sm">點擊或拖曳上傳 Excel 檔案</p>
                    <p className="text-gray-600 text-xs mt-1">.xlsx / .xls 格式</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleEvaluate}
                disabled={!file || loading}
                className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? '評估中...' : '執行訂貨評估'}
              </button>
            </div>
          </div>
        </div>

        {results && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-300">評估結果</span>
              <button
                onClick={handleExport}
                className="text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 px-3 py-1 rounded-lg transition-colors"
              >
                匯出 CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              {results[0] && Object.keys(results[0]).length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {Object.keys(results[0]).map((k) => (
                        <th key={k} className="px-4 py-2 text-left text-gray-500 font-medium">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {results.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-4 py-2 text-gray-300">
                            {String(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <pre className="p-5 text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(results, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-600 text-center">
            採購部 Agent 目前為本機模式（localhost:8001），部署後自動啟用完整功能
          </p>
        </div>
      </div>
    </main>
  );
}
