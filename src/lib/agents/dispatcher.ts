import { getAgent } from './registry';
import { Task, AgentResponse } from '../types';
import { composeNotificationMessage } from '../orchestrator/composeNotification';

// 呼叫對應 Agent 的 API
export async function dispatchTask(task: Task): Promise<AgentResponse> {
  const agent = getAgent(task.to);
  if (!agent || !agent.baseUrl) {
    return { success: false, error: `Agent "${task.to}" 未設定或 URL 為空` };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    // GAS：key= querystring 鑑權；其他 agent：X-Agent-Key header
    const isGas = agent.baseUrl.includes('script.google.com');
    let url: string;
    if (isGas) {
      const params = new URLSearchParams({ action: task.action });
      if (agent.apiKey) params.set('key', agent.apiKey);
      url = `${agent.baseUrl}?${params}`;
    } else if (task.to === 'realestate') {
      // 房地產整合器統一端點 /api/agent/lookup（不管 591 還是永慶 URL）
      url = `${agent.baseUrl}/api/agent/lookup`;
      if (agent.apiKey) headers['X-Agent-Key'] = agent.apiKey;
    } else {
      url = `${agent.baseUrl}/api/agent/${task.action}`;
      if (agent.apiKey) headers['X-Agent-Key'] = agent.apiKey;
    }

    // 所有 agent 統一把 payload 展開到 body 頂層，taskId 保留
    // （GAS 吃 products 陣列、小助理吃 userId+message，都在 body root）
    const payload = { ...task.payload };
    // 小助理 notify/report、房地產 lookup：若未帶 userId，自動補入預設
    // （房地產 App 會用此 userId 把查詢結果推回 LINE）
    const needsUserId = task.to === 'assistant' || task.to === 'realestate';
    if (needsUserId && !payload.userId && process.env.DEFAULT_LINE_USER_ID) {
      payload.userId = process.env.DEFAULT_LINE_USER_ID;
    }
    const bodyData = { taskId: task.taskId, ...payload };

    // 90 秒 timeout（Gemini 生圖 / Veo 生影片可能需要 60 秒以上）
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
      signal: AbortSignal.timeout(90_000),
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

    // 小助理的 notify/report：把依賴任務的實際結果整合成 LINE 訊息
    const isAssistantNotify =
      task.to === 'assistant' && (task.action === 'notify' || task.action === 'report');
    if (isAssistantNotify && task.dependsOn && task.dependsOn.length > 0) {
      const deps = task.dependsOn
        .map((i) => results[i])
        .filter((t): t is Task => !!t && t.status === 'done');
      if (deps.length > 0) {
        try {
          const composed = await composeNotificationMessage(task, deps);
          task.payload = { ...task.payload, message: composed };
        } catch (err) {
          console.warn('[dispatcher] 組合通知訊息失敗，fallback 用原始 message:', err);
        }
      }
    }

    const res = await dispatchTask(task);
    task.status = res.success ? 'done' : 'error';
    task.result = res.data;
    task.error = res.error;
    task.completedAt = new Date().toISOString();
  }

  return results;
}
