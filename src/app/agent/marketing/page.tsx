'use client';

import { useState } from 'react';
import Link from 'next/link';

const STYLES = ['簡約清新', '活潑可愛', '高端質感', '韓系時尚', '運動風格'];

interface MarketingResult {
  copy?: string;
  image?: string;
  video?: string;
}

export default function MarketingPage() {
  const [product, setProduct] = useState('');
  const [style, setStyle] = useState(STYLES[0]);
  const [copyLoading, setCopyLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [result, setResult] = useState<MarketingResult>({});
  const [error, setError] = useState<string | null>(null);

  async function handleAction(type: 'copy' | 'image' | 'video') {
    if (!product.trim()) return;
    setError(null);

    const actionMap = {
      copy: 'generate-copy',
      image: 'generate-image',
      video: 'generate-video',
    } as const;

    const setLoader =
      type === 'copy' ? setCopyLoading : type === 'image' ? setImageLoading : setVideoLoading;

    setLoader(true);
    try {
      const res = await fetch('/api/agent/marketing/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionMap[type],
          payload: { product: product.trim(), style },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '執行失敗');

      const content =
        typeof data.data?.result === 'string'
          ? data.data.result
          : typeof data.data === 'string'
            ? data.data
            : JSON.stringify(data.data, null, 2);

      setResult((prev) => ({ ...prev, [type]: content }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '執行失敗');
    } finally {
      setLoader(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← 返回
          </Link>
          <div className="w-px h-4 bg-gray-700" />
          <span className="text-xl">🎨</span>
          <span className="font-semibold text-white">行銷設計部</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-600/5 p-px">
          <div className="rounded-xl bg-gray-900 p-6 space-y-5">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">
                商品資訊
              </label>
              <textarea
                className="w-full bg-gray-800 text-gray-100 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-600 border border-gray-700"
                rows={3}
                placeholder="例：韓國竹纖維短襪，黑色，男女通用，尺寸 22-27cm，透氣舒適不悶熱"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest block mb-2">
                風格選擇
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      style === s
                        ? 'bg-purple-600 text-white border-purple-500'
                        : 'text-gray-400 border-gray-700 hover:border-purple-500/50 hover:text-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleAction('copy')}
                disabled={copyLoading || !product.trim()}
                className="flex-1 min-w-[120px] bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {copyLoading ? '生成中...' : '生成文案'}
              </button>
              <button
                onClick={() => handleAction('image')}
                disabled={imageLoading || !product.trim()}
                className="flex-1 min-w-[120px] border border-purple-500/40 hover:bg-purple-600/20 disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-700 text-purple-300 text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {imageLoading ? '生成中...' : '生成圖片'}
              </button>
              <button
                onClick={() => handleAction('video')}
                disabled={videoLoading || !product.trim()}
                className="flex-1 min-w-[120px] border border-purple-500/20 hover:bg-purple-600/10 disabled:bg-gray-700 disabled:text-gray-500 disabled:border-gray-700 text-purple-400/70 text-sm font-medium py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {videoLoading ? '生成中...' : '生成影片腳本'}
              </button>
            </div>
          </div>
        </div>

        {/* 結果顯示 */}
        {result.copy && (
          <div className="bg-gray-900 rounded-xl border border-purple-500/20 p-5 space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-widest block">文案</span>
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{result.copy}</p>
            <button
              onClick={() => navigator.clipboard.writeText(result.copy!)}
              className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              複製
            </button>
          </div>
        )}

        {result.image && (
          <div className="bg-gray-900 rounded-xl border border-purple-500/20 p-5 space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-widest block">圖片</span>
            {result.image.startsWith('http') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.image} alt="生成圖片" className="rounded-lg max-w-full" />
            ) : (
              <pre className="text-xs text-gray-400 overflow-x-auto">{result.image}</pre>
            )}
          </div>
        )}

        {result.video && (
          <div className="bg-gray-900 rounded-xl border border-purple-500/20 p-5 space-y-3">
            <span className="text-xs text-gray-500 uppercase tracking-widest block">影片腳本</span>
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{result.video}</p>
            <button
              onClick={() => navigator.clipboard.writeText(result.video!)}
              className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              複製
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
