// Pipeline 執行狀態的 in-memory store
// MVP 階段用 Map；Zeabur 單實例部署夠用，未來可換 Redis

import { PipelineRun } from './pipeline';

// 用 globalThis 避免 Next.js dev HMR 導致 Map 被重建
const globalStore = globalThis as unknown as { __pipelineRuns?: Map<string, PipelineRun> };
if (!globalStore.__pipelineRuns) {
  globalStore.__pipelineRuns = new Map();
}
const store = globalStore.__pipelineRuns;

// 限制總量避免 OOM（MVP 保留最近 100 個 run）
const MAX_RUNS = 100;

export function saveRun(run: PipelineRun): void {
  store.set(run.runId, run);
  if (store.size > MAX_RUNS) {
    // 移除最舊的（Map 保留插入順序）
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
}

export function getRun(runId: string): PipelineRun | undefined {
  return store.get(runId);
}

export function listRuns(): PipelineRun[] {
  return Array.from(store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function deleteRun(runId: string): boolean {
  return store.delete(runId);
}
