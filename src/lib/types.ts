import { v4 as uuidv4 } from 'uuid';

export interface Task {
  taskId: string;
  from: string;
  to: string;
  action: string;
  payload: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
  status: 'pending' | 'running' | 'done' | 'error';
  result?: unknown;
  error?: string;
  dependsOn?: number[];
  createdAt: string;
  completedAt?: string;
}

export interface OrchestrationRequest {
  instruction: string;
  userId?: string;
}

export interface OrchestrationResult {
  taskId: string;
  status: 'done' | 'partial' | 'error';
  subtasks: Task[];
  summary: string;
}

export interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export function createTask(partial: Omit<Task, 'taskId' | 'createdAt' | 'status'>): Task {
  return {
    ...partial,
    taskId: uuidv4(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}
