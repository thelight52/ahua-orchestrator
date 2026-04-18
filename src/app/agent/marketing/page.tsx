'use client';

import { useState } from 'react';
import AgentHeader from '@/components/AgentHeader';
import { AGENT_THEMES } from '@/lib/ui/agentTheme';

type Tab = 'copy' | 'image' | 'video';

export default function MarketingAgentPage() {
  const theme = AGENT_THEMES.marketing;
  const [tab, setTab] = useState<Tab>('copy');
  const [productName, setProductName] = useState('');

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'copy', label: '文案生成', emoji: '✍️' },
    { id: 'image', label: '實穿照', emoji: '👕' },
    { id: 'video', label: '短影音', emoji: '🎬' },
  ];

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <AgentHeader theme={theme} />

        <div className="mb-4 bg-amber-900/20 border border-amber-800/50 text-amber-300 rounded-xl p-3 text-xs">
          🚧 介面佔位中 — API 接上後可直接生成素材
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? `${theme.button} text-white`
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <section className={`bg-gradient-to-br ${theme.bgGradient} border ${theme.border} rounded-2xl p-6`}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                商品名稱
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="例：滿版立體線條小笑臉狗狗船型襪"
                className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
              />
            </div>

            {tab === 'copy' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                    平台
                  </label>
                  <div className="flex gap-2">
                    {['IG', 'FB', 'LINE'].map((p) => (
                      <button
                        key={p}
                        className="px-4 py-2 bg-gray-900 text-gray-400 rounded-lg text-sm hover:bg-gray-800"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  disabled
                  className="w-full bg-gray-700 text-gray-400 font-medium py-2.5 rounded-lg cursor-not-allowed"
                >
                  ✍️ 生成文案（待串接）
                </button>
              </>
            )}

            {tab === 'image' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                    上傳平拍照
                  </label>
                  <label
                    className={`flex flex-col items-center justify-center gap-2 bg-gray-950/70 border-2 border-dashed ${theme.border} rounded-xl p-8 cursor-pointer hover:border-purple-600`}
                  >
                    <span className="text-4xl">🖼</span>
                    <span className="text-sm text-gray-400">點擊上傳商品平拍照</span>
                    <input type="file" accept="image/*" className="hidden" />
                  </label>
                </div>
                <button
                  disabled
                  className="w-full bg-gray-700 text-gray-400 font-medium py-2.5 rounded-lg cursor-not-allowed"
                >
                  👕 生成模特兒實穿照（待串接）
                </button>
              </>
            )}

            {tab === 'video' && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                    影片風格
                  </label>
                  <select
                    className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
                  >
                    <option>活潑俏皮</option>
                    <option>優雅質感</option>
                    <option>運動活力</option>
                  </select>
                </div>
                <button
                  disabled
                  className="w-full bg-gray-700 text-gray-400 font-medium py-2.5 rounded-lg cursor-not-allowed"
                >
                  🎬 生成短影音腳本（待串接）
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
