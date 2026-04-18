'use client';

import { useState } from 'react';
import AgentHeader from '@/components/AgentHeader';
import { AGENT_THEMES } from '@/lib/ui/agentTheme';

export default function ProcurementAgentPage() {
  const theme = AGENT_THEMES.procurement;
  const [file, setFile] = useState<File | null>(null);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <AgentHeader theme={theme} />

        <div className="mb-4 bg-amber-900/20 border border-amber-800/50 text-amber-300 rounded-xl p-3 text-xs">
          🚧 介面佔位中 — API 接上後可直接執行評估
        </div>

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
                  {file ? file.name : '點擊選擇 .xlsx 檔案'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <button
              disabled
              title="採購部 API 尚未串接"
              className="w-full bg-gray-700 text-gray-400 font-medium py-2.5 rounded-lg cursor-not-allowed"
            >
              🧮 執行評估（待串接）
            </button>
          </div>
        </section>

        <section className={`bg-gradient-to-br ${theme.bgGradient} border ${theme.border} rounded-2xl p-6`}>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">其他功能</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              disabled
              className="bg-gray-800 text-gray-500 text-sm py-3 rounded-lg cursor-not-allowed text-left px-4"
            >
              🏷 圖片標註（待串接）
            </button>
            <button
              disabled
              className="bg-gray-800 text-gray-500 text-sm py-3 rounded-lg cursor-not-allowed text-left px-4"
            >
              📦 1688 採購清單（待串接）
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
