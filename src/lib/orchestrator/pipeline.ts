// Pipeline 引擎：DAG 工作流執行器
// - 拓撲排序決定同層任務可並行
// - 前置任務的 result 會自動注入後續任務 payload（模板變數 {{task[N].xxx}}）
// - 遇到 requireConfirmation 時暫停，等人工確認
// - Task 失敗會自動重試 2 次，exponential backoff（1s, 3s）
// - 失敗的 task 不會中斷 pipeline，只跳過依賴它的後續 task

import { v4 as uuidv4 } from 'uuid';
import { dispatchTask } from '../agents/dispatcher';
import { createTask } from '../types';

export type AgentId = 'product' | 'assistant' | 'procurement' | 'marketing' | 'realestate';

export interface PipelineTask {
  id: number;
  agent: AgentId;
  action: string;
  payload: Record<string, unknown>;
  dependsOn: number[];
  requireConfirmation?: boolean;
  confirmMessage?: string;
}

export interface Pipeline {
  id?: string;
  name: string;
  description?: string;
  tasks: PipelineTask[];
}

export type TaskRunStatus =
  | 'pending'
  | 'awaiting_confirm'
  | 'running'
  | 'done'
  | 'error'
  | 'skipped'
  | 'cancelled';

export interface TaskRun {
  id: number;
  agent: AgentId;
  action: string;
  status: TaskRunStatus;
  payload: Record<string, unknown>;
  result?: unknown;
  error?: string;
  attempts: number;
  startedAt?: string;
  completedAt?: string;
  requireConfirmation?: boolean;
  confirmMessage?: string;
}

export type PipelineRunStatus = 'running' | 'awaiting_confirm' | 'done' | 'partial' | 'error' | 'cancelled';

export interface PipelineRun {
  runId: string;
  pipeline: Pipeline;
  userId?: string;
  status: PipelineRunStatus;
  tasks: TaskRun[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  awaitingTaskId?: number;
}

const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [1000, 3000];

// ============ 模板變數注入 ============
// 支援 {{task[N].result.path.to.value}} 和 {{task[N].result}}
// 路徑用 . 分隔，支援陣列索引 [N]

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.').flatMap((p) => {
    const m = p.match(/^([^\[]+)((?:\[\d+\])*)$/);
    if (!m) return [p];
    const key = m[1];
    const brackets = [...(m[2]?.matchAll(/\[(\d+)\]/g) ?? [])].map((x) => Number(x[1]));
    return [key, ...brackets];
  });
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    if (typeof cur === 'object') {
      cur = (cur as Record<string | number, unknown>)[part as string | number];
    } else {
      return undefined;
    }
  }
  return cur;
}

function resolveTemplate(
  value: unknown,
  taskResults: Map<number, TaskRun>
): unknown {
  if (typeof value === 'string') {
    // 整個字串就是單一 {{...}} → 可以回傳 object/array 等非字串值
    const wholeMatch = value.match(/^\{\{task\[(\d+)\](?:\.(.+?))?\}\}$/);
    if (wholeMatch) {
      const taskId = Number(wholeMatch[1]);
      const path = wholeMatch[2] ?? '';
      const task = taskResults.get(taskId);
      if (!task) return undefined;
      return getByPath(task, path);
    }
    // 字串內插：多個 {{...}} → 全部轉字串
    return value.replace(/\{\{task\[(\d+)\](?:\.(.+?))?\}\}/g, (_, idStr, path) => {
      const task = taskResults.get(Number(idStr));
      if (!task) return '';
      const v = getByPath(task, path ?? '');
      if (v == null) return '';
      return typeof v === 'string' ? v : JSON.stringify(v);
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplate(v, taskResults));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveTemplate(v, taskResults);
    }
    return out;
  }
  return value;
}

// ============ Pipeline 驗證 ============

export function validatePipeline(pipeline: Pipeline): string | null {
  if (!pipeline.tasks || pipeline.tasks.length === 0) return '工作流至少需要一個任務';
  const ids = new Set(pipeline.tasks.map((t) => t.id));
  if (ids.size !== pipeline.tasks.length) return 'Task id 不可重複';
  for (const t of pipeline.tasks) {
    for (const dep of t.dependsOn ?? []) {
      if (!ids.has(dep)) return `Task ${t.id} 依賴不存在的 task ${dep}`;
      if (dep === t.id) return `Task ${t.id} 不能依賴自己`;
    }
  }
  // 偵測循環依賴（簡易 DFS）
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const taskMap = new Map(pipeline.tasks.map((t) => [t.id, t]));
  function dfs(id: number): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const task = taskMap.get(id);
    for (const dep of task?.dependsOn ?? []) {
      if (dfs(dep)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  for (const t of pipeline.tasks) {
    if (dfs(t.id)) return `偵測到循環依賴（涉及 task ${t.id}）`;
  }
  return null;
}

// ============ 執行單一 task（含重試） ============

async function runOneTask(
  taskRun: TaskRun,
  resolvedPayload: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    taskRun.attempts = attempt + 1;
    const task = createTask({
      from: 'pipeline',
      to: taskRun.agent,
      action: taskRun.action,
      payload: resolvedPayload,
      priority: 'normal',
    });
    const res = await dispatchTask(task);
    if (res.success) return { success: true, data: res.data };
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt] ?? 3000));
      continue;
    }
    return { success: false, error: res.error };
  }
  return { success: false, error: '重試次數用盡' };
}

// ============ 取得 ready 的 task（依賴都完成 & 自己 pending） ============

function getReadyTasks(run: PipelineRun): TaskRun[] {
  const resultMap = new Map(run.tasks.map((t) => [t.id, t]));
  return run.tasks.filter((t) => {
    if (t.status !== 'pending') return false;
    const pipelineTask = run.pipeline.tasks.find((p) => p.id === t.id);
    if (!pipelineTask) return false;
    // 所有依賴必須都是 done（skipped/error 的依賴會讓此 task skip）
    return pipelineTask.dependsOn.every((dep) => {
      const d = resultMap.get(dep);
      return d?.status === 'done';
    });
  });
}

// 找出因依賴失敗而該 skip 的 task
function getTasksToSkip(run: PipelineRun): TaskRun[] {
  const resultMap = new Map(run.tasks.map((t) => [t.id, t]));
  return run.tasks.filter((t) => {
    if (t.status !== 'pending') return false;
    const pipelineTask = run.pipeline.tasks.find((p) => p.id === t.id);
    if (!pipelineTask) return false;
    return pipelineTask.dependsOn.some((dep) => {
      const d = resultMap.get(dep);
      return d?.status === 'error' || d?.status === 'skipped' || d?.status === 'cancelled';
    });
  });
}

// ============ 推進一個 run（核心狀態機） ============

// 呼叫時機：1. 初次啟動  2. 某批 task 完成後  3. 使用者確認完成後
// 回傳：是否還有後續可推進（false 代表 run 結束或正在等待）
export async function advanceRun(
  run: PipelineRun,
  onTaskUpdate?: (task: TaskRun) => void
): Promise<void> {
  while (true) {
    if (run.status === 'cancelled') return;

    // 先處理該 skip 的 task
    const toSkip = getTasksToSkip(run);
    for (const t of toSkip) {
      t.status = 'skipped';
      t.error = '依賴的前置任務失敗或被跳過';
      t.completedAt = new Date().toISOString();
      onTaskUpdate?.(t);
    }

    const ready = getReadyTasks(run);
    if (ready.length === 0) {
      // 沒有 ready 的 task → 看整體狀態
      const allDone = run.tasks.every((t) =>
        ['done', 'skipped', 'error', 'cancelled'].includes(t.status)
      );
      if (allDone) {
        const hasError = run.tasks.some((t) => t.status === 'error' || t.status === 'skipped');
        const allError = run.tasks.every((t) => t.status !== 'done');
        run.status = allError ? 'error' : hasError ? 'partial' : 'done';
        run.completedAt = new Date().toISOString();
      }
      run.updatedAt = new Date().toISOString();
      return;
    }

    // 檢查 ready 中有沒有需要確認的任務（必須在執行前暫停）
    const needConfirm = ready.find((t) => t.requireConfirmation && t.status === 'pending');
    if (needConfirm) {
      needConfirm.status = 'awaiting_confirm';
      run.status = 'awaiting_confirm';
      run.awaitingTaskId = needConfirm.id;
      run.updatedAt = new Date().toISOString();
      onTaskUpdate?.(needConfirm);
      return;
    }

    // 執行這一批 ready tasks（並行）
    await Promise.all(
      ready.map(async (t) => {
        t.status = 'running';
        t.startedAt = new Date().toISOString();
        onTaskUpdate?.(t);

        // 解析模板變數
        const taskResultMap = new Map(run.tasks.map((tr) => [tr.id, tr]));
        const resolved = resolveTemplate(t.payload, taskResultMap) as Record<string, unknown>;

        const res = await runOneTask(t, resolved);
        t.completedAt = new Date().toISOString();
        if (res.success) {
          t.status = 'done';
          t.result = res.data;
        } else {
          t.status = 'error';
          t.error = res.error;
        }
        onTaskUpdate?.(t);
      })
    );
    run.updatedAt = new Date().toISOString();
    // 繼續下一輪
  }
}

// ============ 建立新 run ============

export function createPipelineRun(pipeline: Pipeline, userId?: string): PipelineRun {
  const runId = uuidv4();
  const now = new Date().toISOString();
  const taskRuns: TaskRun[] = pipeline.tasks.map((t) => ({
    id: t.id,
    agent: t.agent,
    action: t.action,
    status: 'pending',
    payload: t.payload,
    attempts: 0,
    requireConfirmation: t.requireConfirmation,
    confirmMessage: t.confirmMessage,
  }));
  return {
    runId,
    pipeline: { ...pipeline, id: runId },
    userId,
    status: 'running',
    tasks: taskRuns,
    createdAt: now,
    updatedAt: now,
  };
}

// ============ 確認一個等待中的 task ============

export function applyConfirmation(run: PipelineRun, taskId: number, confirmed: boolean): void {
  const t = run.tasks.find((x) => x.id === taskId);
  if (!t) throw new Error(`找不到 task ${taskId}`);
  if (t.status !== 'awaiting_confirm') throw new Error(`Task ${taskId} 目前狀態是 ${t.status}，非 awaiting_confirm`);
  if (confirmed) {
    t.status = 'pending'; // 放回 ready 讓 advanceRun 跑它（但清除 requireConfirmation 避免死循環）
    t.requireConfirmation = false;
    run.status = 'running';
    run.awaitingTaskId = undefined;
  } else {
    t.status = 'cancelled';
    t.error = '使用者取消';
    t.completedAt = new Date().toISOString();
    run.status = 'running'; // 讓 advanceRun 重算整體狀態
    run.awaitingTaskId = undefined;
  }
  run.updatedAt = new Date().toISOString();
}

export { resolveTemplate };
