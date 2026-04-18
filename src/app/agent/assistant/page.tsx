'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AssistantPage() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setSent(false);
    setError(null);

    try {
      const res = await fetch('/api/agent/assistant/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          payload: { message: message.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '推播失敗');
      setSent(true);
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '推播失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← 返回
          </Link>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xl">💬</span>
          <span className="font-semibold text-white">小助理</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-green-500/30 to-green-600/5 p-px">
          <div className="rounded-xl bg-gray-900 p-6 space-y-5">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">
                推播對象
              </label>
              <div className="bg-gray-800 border border-gray-700 text-gray-400 text-sm rounded-lg px-3 py-2">
                Chester（預設）
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">
                訊息內容
              </label>
              <textarea
                className="w-full bg-gray-800 text-gray-100 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-600 border border-gray-700"
                rows={6}
                placeholder="輸入要推播到 LINE 的訊息..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
                }}
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            {sent && (
              <div className="bg-green-900/30 border border-green-700 text-green-300 rounded-lg p-3 text-sm">
                推播成功！Chester 的 LINE 已收到通知。
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Ctrl + Enter 送出</span>
              <button
                onClick={handleSend}
                disabled={loading || !message.trim()}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? '推播中...' : '推播'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-600">
            透過小助理的 LINE Messaging API 推播訊息給指定用戶。訊息會立即送達 LINE。
          </p>
        </div>
      </div>
    </main>
  );
}
