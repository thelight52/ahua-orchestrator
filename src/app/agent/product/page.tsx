'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ProductRow {
  barcode: string;
  name: string;
  category: string;
}

interface ProductResult {
  barcode?: string;
  title?: string;
  description?: string;
  hashtags?: string;
  error?: string;
}

export default function ProductPage() {
  const [rows, setRows] = useState<ProductRow[]>([{ barcode: '', name: '', category: '' }]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductResult[]>([]);
  const [notifyLoading, setNotifyLoading] = useState<number | null>(null);
  const [notifyDone, setNotifyDone] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((prev) => [...prev, { barcode: '', name: '', category: '' }]);
  }

  function updateRow(i: number, field: keyof ProductRow, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function removeRow(i: number) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleGenerate() {
    const validRows = rows.filter((r) => r.barcode.trim() || r.name.trim());
    if (!validRows.length) return;
    setLoading(true);
    setResults([]);
    setError(null);

    try {
      const products = validRows.map((r) => ({
        barcode: r.barcode.trim(),
        name: r.name.trim(),
        ...(r.category.trim() ? { category: r.category.trim() } : {}),
      }));

      const res = await fetch('/api/agent/product/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'product-intro', payload: { products } }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '呼叫失敗');

      const arr: ProductResult[] = Array.isArray(data.data?.results)
        ? data.data.results
        : Array.isArray(data.data)
          ? data.data
          : [data.data ?? { error: '無回應' }];
      setResults(arr);
    } catch (err) {
      setError(err instanceof Error ? err.message : '執行失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleNotify(i: number, result: ProductResult) {
    setNotifyLoading(i);
    try {
      const message = [
        result.title ? `📦 ${result.title}` : '',
        result.description ?? '',
        result.hashtags ? `\n${result.hashtags}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await fetch('/api/agent/assistant/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'notify', payload: { message } }),
      });
      setNotifyDone((prev) => [...prev, i]);
    } finally {
      setNotifyLoading(null);
    }
  }

  function copyResult(result: ProductResult) {
    navigator.clipboard.writeText(
      [result.title, result.description, result.hashtags].filter(Boolean).join('\n\n'),
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← 返回
          </Link>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xl">📦</span>
          <span className="font-semibold text-white">商品部</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* 商品輸入表格 */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">商品清單</span>
            <button
              onClick={addRow}
              className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg transition-colors"
            >
              + 新增商品
            </button>
          </div>

          {/* 表頭 */}
          <div className="px-5 py-2 grid grid-cols-[1fr_1.5fr_1fr_28px] gap-3 border-b border-gray-800">
            <span className="text-xs text-gray-600">條碼</span>
            <span className="text-xs text-gray-600">商品名稱</span>
            <span className="text-xs text-gray-600">分類（選填）</span>
            <span />
          </div>

          <div className="divide-y divide-gray-800">
            {rows.map((row, i) => (
              <div key={i} className="px-5 py-3 grid grid-cols-[1fr_1.5fr_1fr_28px] gap-3 items-center">
                <input
                  className="bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full"
                  placeholder="K2505"
                  value={row.barcode}
                  onChange={(e) => updateRow(i, 'barcode', e.target.value)}
                />
                <input
                  className="bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full"
                  placeholder="韓國竹纖維短襪"
                  value={row.name}
                  onChange={(e) => updateRow(i, 'name', e.target.value)}
                />
                <input
                  className="bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-600 w-full"
                  placeholder="女襪"
                  value={row.category}
                  onChange={(e) => updateRow(i, 'category', e.target.value)}
                />
                <button
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  className="text-gray-600 hover:text-red-400 disabled:opacity-20 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={loading || rows.every((r) => !r.barcode.trim() && !r.name.trim())}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? '生成中...' : '生成簡介'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-4 text-sm">
            {error}
          </div>
        )}

        {/* 生成結果 */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest">生成結果</h2>
            {results.map((r, i) => (
              <div
                key={i}
                className="rounded-xl bg-gradient-to-br from-blue-500/30 to-blue-600/5 p-px"
              >
                <div className="rounded-xl bg-gray-900 p-5 space-y-3">
                  {r.error ? (
                    <p className="text-red-400 text-sm">{r.error}</p>
                  ) : (
                    <>
                      {r.title && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">
                            標題
                          </span>
                          <p className="text-gray-100 font-medium">{r.title}</p>
                        </div>
                      )}
                      {r.description && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">
                            描述
                          </span>
                          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {r.description}
                          </p>
                        </div>
                      )}
                      {r.hashtags && (
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-widest block mb-1">
                            Hashtags
                          </span>
                          <p className="text-blue-400 text-sm">{r.hashtags}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => copyResult(r)}
                          className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          複製
                        </button>
                        <button
                          onClick={() => handleNotify(i, r)}
                          disabled={notifyLoading === i || notifyDone.includes(i)}
                          className="text-xs text-green-400 hover:text-green-300 border border-green-500/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {notifyDone.includes(i)
                            ? '已推播 ✓'
                            : notifyLoading === i
                              ? '推播中...'
                              : 'LINE 通知我'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
