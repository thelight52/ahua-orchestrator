import { getAgent } from './registry';
import { Task, AgentResponse } from '../types';

// 呼叫對應 Agent 的 API
export async function dispatchTask(task: Task): Promise<AgentResponse> {
  const agent = getAgent(task.to);
  if (!agent || !agent.baseUrl) {
    return { success: false, error: `Agent "${task.to}" 未設定或 URL 為空` };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (agent.apiKey) {
    headers['Authorization'] = `Bearer ${agent.apiKey}`;
  }

  try {
    // GAS 用 key= querystring 鑑權，其他 agent 用 Authorization header
    const isGas = agent.baseUrl.includes('script.google.com');
    let url: string;
    if (isGas) {
      const params = new URLSearchParams({ action: task.action });
      if (agent.apiKey) params.set('key', agent.apiKey);
      url = `${agent.baseUrl}?${params}`;
      delete headers['Authorization'];
    } else {
      url = `${agent.baseUrl}/api/agent/${task.action}`;
    }

    // GAS 期望 products 等欄位在 body 最頂層（不包在 payload 裡）
    const bodyData = isGas
      ? { taskId: task.taskId, ...task.payload }
      : { taskId: task.taskId, from: task.from, action: task.action, payload: task.payload };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${await response.text()}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// 檢查 Agent 健康狀態
export async function checkHealth(agentId: string): Promise<boolean> {
  const agent = getAgent(agentId);
  if (!agent || !agent.baseUrl || !agent.healthEndpoint) return false;

  try {
    const response = await fetch(`${agent.baseUrl}${agent.healthEndpoint}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 並行分派多個任務（考慮 dependsOn）
export async function dispatchMultiple(tasks: Task[]): Promise<Task[]> {
  const results = [...tasks];

  // Phase 1：先執行沒有依賴的任務
  const noDeps = results.filter((t) => !t.dependsOn || t.dependsOn.length === 0);
  const hasDeps = results.filter((t) => t.dependsOn && t.dependsOn.length > 0);

  await Promise.all(
    noDeps.map(async (task) => {
      task.status = 'running';
      const res = await dispatchTask(task);
      task.status = res.success ? 'done' : 'error';
      task.result = res.data;
      task.error = res.error;
      task.completedAt = new Date().toISOString();
    })
  );

  // Phase 2：依序執行有依賴的任務
  for (const task of hasDeps) {
    task.status = 'running';
    const res = await dispatchTask(task);
    task.status = res.success ? 'done' : 'error';
    task.result = res.data;
    task.error = res.error;
    task.completedAt = new Date().toISOString();
  }

  return results;
}
