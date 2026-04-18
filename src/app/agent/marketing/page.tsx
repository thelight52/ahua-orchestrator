'use client';

import { useState } from 'react';
import AgentHeader from '@/components/AgentHeader';
import { AGENT_THEMES } from '@/lib/ui/agentTheme';

type Tab = 'copy' | 'image' | 'video';

interface CopyResult {
  igCaption?: string;
  productDescription?: string;
  highlights?: string | string[];
}

interface ImageResult {
  generatedImageUrl?: string;
}

interface VideoResult {
  videoUrl?: string;
  script?: string;
}

const PLATFORMS = ['IG', 'FB', 'LINE'] as const;
const VIDEO_STYLES = ['活潑俏皮', '優雅質感', '運動活力'];

function extractError(err: unknown, fallback = '執行失敗'): string {
  if (err instanceof Error) return err.message;
  return fallback;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function MarketingAgentPage() {
  const theme = AGENT_THEMES.marketing;
  const [tab, setTab] = useState<Tab>('copy');

  // 共用商品名稱
  const [productName, setProductName] = useState('');

  // 文案
  const [category, setCategory] = useState('');
  const [features, setFeatures] = useState('');
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('IG');
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // 圖片
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState('電商主圖');
  const [imageResult, setImageResult] = useState<ImageResult | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // 影片
  const [videoDescription, setVideoDescription] = useState('');
  const [videoStyle, setVideoStyle] = useState(VIDEO_STYLES[0]);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  async function invokeMarketing(action: string, payload: Record<string, unknown>) {
    const res = await fetch('/api/agent/marketing/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
    const raw = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error('行銷設計部目前離線或未啟用 API 模式（需在 Zeabur 設 APP_MODE=api）');
    }
    if (!res.ok || data.success === false) {
      const msg = String(data.error ?? `HTTP ${res.status}`);
      // Streamlit 模式：403 Forbidden 或 HTML 回應 → API 未啟用
      if (/403|Forbidden|<html|<!DOCTYPE|Tornado/i.test(msg)) {
        throw new Error('行銷設計部目前以 Streamlit 模式運行，API 尚未啟用。請到 Zeabur 設定 APP_MODE=api 並重新部署。');
      }
      throw new Error(msg);
    }
    return data.data;
  }

  async function handleGenerateCopy() {
    if (!productName.trim() || !category.trim() || copyLoading) return;
    setCopyLoading(true);
    setCopyError(null);
    setCopyResult(null);
    try {
      const data = await invokeMarketing('generate-copy', {
        product: {
          name: productName.trim(),
          category: category.trim(),
          features: features
            .split(/[,，\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          tone: platform === 'IG' ? '輕鬆活潑' : platform === 'FB' ? '詳細說明' : '親切友善',
        },
      });
      setCopyResult(data as CopyResult);
    } catch (err) {
      setCopyError(extractError(err));
    } finally {
      setCopyLoading(false);
    }
  }

  async function handleGenerateImage() {
    if (!imageFile || imageLoading) return;
    setImageLoading(true);
    setImageError(null);
    setImageResult(null);
    try {
      const productImageBase64 = await fileToBase64(imageFile);
      const data = await invokeMarketing('generate-image', {
        productImageBase64,
        style: imageStyle,
      });
      setImageResult(data as ImageResult);
    } catch (err) {
      setImageError(extractError(err));
    } finally {
      setImageLoading(false);
    }
  }

  async function handleGenerateVideo() {
    if (!productName.trim() || videoLoading) return;
    setVideoLoading(true);
    setVideoError(null);
    setVideoResult(null);
    try {
      const data = await invokeMarketing('generate-video', {
        product: {
          name: productName.trim(),
          description: videoDescription.trim() || `${videoStyle}風格的${productName.trim()}`,
        },
      });
      setVideoResult(data as VideoResult);
    } catch (err) {
      setVideoError(extractError(err));
    } finally {
      setVideoLoading(false);
    }
  }

  function handleImageFile(f: File | null) {
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : null);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: 'copy', label: '文案生成', emoji: '✍️' },
    { id: 'image', label: '實穿照', emoji: '👕' },
    { id: 'video', label: '短影音', emoji: '🎬' },
  ];

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <AgentHeader theme={theme} />

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

        <section className={`bg-gradient-to-br ${theme.bgGradient} border ${theme.border} rounded-2xl p-6 mb-6`}>
          {tab !== 'image' && (
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                商品名稱 *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="例：滿版立體線條小笑臉狗狗船型襪"
                className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
              />
            </div>
          )}

          {tab === 'copy' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  分類 *
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="例：襪子、內衣、配件"
                  className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  商品特色（用逗號或換行分隔）
                </label>
                <textarea
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  rows={3}
                  placeholder="立體線條, 小笑臉狗狗, 韓國製, 彈力舒適"
                  className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring} resize-none`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  平台
                </label>
                <div className="flex gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        platform === p
                          ? `${theme.button} text-white`
                          : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerateCopy}
                disabled={copyLoading || !productName.trim() || !category.trim()}
                className={`w-full ${theme.button} ${theme.buttonHover} disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors`}
              >
                {copyLoading ? '生成中...' : '✍️ 生成文案'}
              </button>
            </div>
          )}

          {tab === 'image' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  上傳平拍照 *
                </label>
                <label
                  className={`flex flex-col items-center justify-center gap-2 bg-gray-950/70 border-2 border-dashed ${theme.border} rounded-xl p-6 cursor-pointer hover:border-purple-600 transition-colors`}
                >
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="preview" className="max-h-40 rounded-lg" />
                  ) : (
                    <>
                      <span className="text-4xl">🖼</span>
                      <span className="text-sm text-gray-400">點擊上傳商品平拍照</span>
                    </>
                  )}
                  <span className="text-xs text-gray-600 mt-1">
                    {imageFile?.name ?? '支援 JPG / PNG'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  風格
                </label>
                <select
                  value={imageStyle}
                  onChange={(e) => setImageStyle(e.target.value)}
                  className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
                >
                  <option>電商主圖</option>
                  <option>模特兒實穿</option>
                  <option>情境生活照</option>
                </select>
              </div>
              <button
                onClick={handleGenerateImage}
                disabled={imageLoading || !imageFile}
                className={`w-full ${theme.button} ${theme.buttonHover} disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors`}
              >
                {imageLoading ? '生成中...' : '👕 生成實穿照'}
              </button>
            </div>
          )}

          {tab === 'video' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  商品描述（選填）
                </label>
                <textarea
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  rows={3}
                  placeholder="產品特色簡述，用於腳本生成"
                  className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring} resize-none`}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                  影片風格
                </label>
                <select
                  value={videoStyle}
                  onChange={(e) => setVideoStyle(e.target.value)}
                  className={`w-full bg-gray-950 text-gray-100 rounded-lg px-4 py-2.5 text-sm border border-gray-800 focus:outline-none focus:ring-2 ${theme.ring}`}
                >
                  {VIDEO_STYLES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleGenerateVideo}
                disabled={videoLoading || !productName.trim()}
                className={`w-full ${theme.button} ${theme.buttonHover} disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-2.5 rounded-lg transition-colors`}
              >
                {videoLoading ? '生成中...' : '🎬 生成短影音'}
              </button>
            </div>
          )}
        </section>

        {/* 結果區 */}
        {tab === 'copy' && copyError && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-4 text-sm">{copyError}</div>
        )}
        {tab === 'copy' && copyResult && (
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
            {copyResult.igCaption && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">IG 文案</label>
                  <button
                    onClick={() => copy(copyResult.igCaption!)}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    📋 複製
                  </button>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{copyResult.igCaption}</p>
              </div>
            )}
            {copyResult.productDescription && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">商品描述</label>
                  <button
                    onClick={() => copy(copyResult.productDescription!)}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    📋 複製
                  </button>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{copyResult.productDescription}</p>
              </div>
            )}
            {copyResult.highlights && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">標籤</label>
                <p className="text-sm text-gray-300">
                  {Array.isArray(copyResult.highlights)
                    ? copyResult.highlights.join(' ')
                    : copyResult.highlights}
                </p>
              </div>
            )}
          </section>
        )}

        {tab === 'image' && imageError && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-4 text-sm">{imageError}</div>
        )}
        {tab === 'image' && imageResult?.generatedImageUrl && (
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-3 block">生成結果</label>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageResult.generatedImageUrl}
              alt="生成結果"
              className="max-w-full rounded-lg border border-gray-800"
            />
            <a
              href={imageResult.generatedImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs text-purple-300 hover:text-purple-200"
            >
              🔗 開新分頁檢視
            </a>
          </section>
        )}

        {tab === 'video' && videoError && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 mb-4 text-sm">{videoError}</div>
        )}
        {tab === 'video' && videoResult && (
          <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
            {videoResult.script && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">影片腳本</label>
                  <button
                    onClick={() => copy(videoResult.script!)}
                    className="text-xs text-gray-400 hover:text-gray-200"
                  >
                    📋 複製
                  </button>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{videoResult.script}</p>
              </div>
            )}
            {videoResult.videoUrl && (
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">影片</label>
                <video controls src={videoResult.videoUrl} className="w-full rounded-lg border border-gray-800" />
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
