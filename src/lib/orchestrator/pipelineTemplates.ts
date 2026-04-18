import { Pipeline } from './pipeline';

// 預設 Pipeline 模板
// 使用者可從 Dashboard 挑一個模板直接跑，或參考格式自己組

export interface PipelineTemplate {
  key: string;
  name: string;
  description: string;
  pipeline: Pipeline;
  inputSchema?: { key: string; label: string; placeholder?: string; required?: boolean }[];
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    key: 'product-intro-to-line',
    name: '商品簡介 → LINE 推播',
    description: '商品部生成簡介 → 經人工確認 → LINE 推播給管理員',
    inputSchema: [
      { key: 'barcode', label: '商品條碼', placeholder: 'K2505', required: true },
      { key: 'name', label: '商品名稱', placeholder: '滿版立體線條小笑臉狗狗船型襪', required: true },
    ],
    pipeline: {
      name: '商品簡介 → LINE 推播',
      tasks: [
        {
          id: 0,
          agent: 'product',
          action: 'product-intro',
          payload: {
            products: [{ barcode: '{{input.barcode}}', name: '{{input.name}}' }],
          },
          dependsOn: [],
        },
        {
          id: 1,
          agent: 'assistant',
          action: 'notify',
          payload: {
            message:
              '📦 商品簡介已生成，請確認後推播\n\n{{task[0].result.result.intros[0].title}}\n\n{{task[0].result.result.intros[0].description}}\n\n{{task[0].result.result.intros[0].highlights}}',
          },
          dependsOn: [0],
          requireConfirmation: true,
          confirmMessage: '商品簡介已生成，是否推播到 LINE？',
        },
      ],
    },
  },
  {
    key: 'product-intro-only',
    name: '商品簡介（單純生成）',
    description: '只生成商品簡介，不推播',
    inputSchema: [
      { key: 'barcode', label: '商品條碼', placeholder: 'K2505', required: true },
      { key: 'name', label: '商品名稱', placeholder: '滿版立體線條小笑臉狗狗船型襪', required: true },
    ],
    pipeline: {
      name: '商品簡介生成',
      tasks: [
        {
          id: 0,
          agent: 'product',
          action: 'product-intro',
          payload: {
            products: [{ barcode: '{{input.barcode}}', name: '{{input.name}}' }],
          },
          dependsOn: [],
        },
      ],
    },
  },
];

// 把 template 的 {{input.xxx}} 替換成實際輸入
export function instantiateTemplate(
  template: PipelineTemplate,
  input: Record<string, string>
): Pipeline {
  const json = JSON.stringify(template.pipeline);
  const filled = json.replace(/\{\{input\.([^}]+)\}\}/g, (_, key) => input[key] ?? '');
  return JSON.parse(filled);
}
