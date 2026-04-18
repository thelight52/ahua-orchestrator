'use client';

import Link from 'next/link';
import { AgentTheme } from '@/lib/ui/agentTheme';

export default function AgentHeader({ theme }: { theme: AgentTheme }) {
  return (
    <header className="mb-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-4 transition-colors"
      >
        ← 返回總覽
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-4xl">{theme.emoji}</span>
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${theme.text}`}>
            {theme.name}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{theme.description}</p>
        </div>
      </div>
    </header>
  );
}
