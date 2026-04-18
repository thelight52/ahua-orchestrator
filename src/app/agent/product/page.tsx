'use client';

import { useState } from 'react';
import AgentHeader from '@/components/AgentHeader';
import { AGENT_THEMES } from '@/lib/ui/agentTheme';

interface Intro {
  barcode: string;
  title: string;
  description: string;
  highlights: string;
  error?: string;
}

interface ProductResult {
  taskId: string;
  status: string;
  result?: { intros: Intro[] };
}

export default function ProductAgentPage() {
  const theme = AGENT_THEMES.product;
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [intro, setIntro] = useState<Intro | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<string | null>(null);
  const [notifyLoading, setNotifyLoading] = useState(false);

  async function handleGenerate() {
    if (!barcode.trim() || !name.trim() || loading) return;
    setLoading(true);
    setError(null);
    setIntro(null);
    setNotifyStatus(null);
    try {
      const product: Record<string, string> = { barcode: barcode.trim(), name: name.trim() };
      if (category.trim()) product.category = category.trim();

      const res = await fetch('/api/agent/product/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'product-intro',
          payload: { products: [product] },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '生成失敗');
      const result = data.data as ProductResult;
      const first = result?.result?.intros?.[0];
      if (!first) throw new Error('商品部未回傳內容');
      if (first.error) throw new Error(first.error);
      setIntro(first);
    } catch (err) {
      setError(err instanceof Error ? err.message : '執行失敗');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!intro) return;
    const text = `${intro.title}\n\n${intro.description}\n\n${intro.highlights}`;
    navigator.clipboard.writeText(text);
    setNotifyStatus('已複製到剪貼簿');
    setTimeout(() => setNotifyStatus(null), 2000);
  }

  async function handleNotify() {
    if (!intro || notifyLoading) return;
    setNotifyLoading(true);
    setNotifyStatus(null);
    try {
      const message =
        `📦 商品簡介\n\n${intro.title}\n\n${intro.description}\n\n${intro.highlights}`;
      const res = await fetch('/api/agent/assistant/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          payload: { message },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'LINE 通知失敗');
      setNotifyStatus('✅ 已推播到 LINE');
    } catch (err) {
      setNotifyStatus(`❌ ${err instanceof Error ? err.message : '推播失敗'}`);
    } finally {
      setNotifyLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <AgentHeader theme={theme} />

        {/* 輸入表單 */}
        <section className={`bg-gradient-to-br ${theme.bgGradient} border ${theme.border} rounded-2xl p-6 mb-6`}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                商品條碼 *
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="K2505"
                className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                商品名稱 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="滿版立體線條小笑臉狗狗船型襪"
                className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                分類（選填）
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="例：襪子、內衣、配件"
                className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={loading || !barcode.trim() || !name.trim()}
              className={`w-full ${theme.button} ${theme.buttonHover} disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors`}
            >
              {loading ? '生成中...' : '生成商品簡介'}
            </button>
          </div>
        </section>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {intro && (
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">標題</label>
              <p className={`text-lg font-bold ${theme.text}`}>{intro.title}</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">描述</label>
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {intro.description}
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">標籤</label>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{intro.highlights}</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={handleCopy}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                📋 複製
              </button>
              <button
                onClick={handleNotify}
                disabled={notifyLoading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {notifyLoading ? '推播中...' : '💬 LINE 通知'}
              </button>
              {notifyStatus && (
                <span className="text-xs text-gray-400 self-center ml-1">{notifyStatus}</span>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
