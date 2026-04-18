import { Pipeline } from './pipeline';

// 預設 Pipeline 模板
// 使用者可從 Dashboard 挑一個模板直接跑，或參考格式自己組

export type InputFieldType = 'text' | 'textarea' | 'image';

export interface InputField {
  key: string;
  label: string;
  type?: InputFieldType; // 預設 'text'
  placeholder?: string;
  required?: boolean;
}

export interface PipelineTemplate {
  key: string;
  name: string;
  description: string;
  pipeline: Pipeline;
  inputSchema?: InputField[];
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    key: 'product-intro-to-line',
    name: '商品簡介 → LINE 推播',
    description: '商品部生成簡介 → 經人工確認 → LINE 推播給管理員',
    inputSchema: [
      { key: 'barcode', label: '商品條碼', type: 'text', placeholder: 'K2505', required: true },
      { key: 'name', label: '商品名稱', type: 'text', placeholder: '滿版立體線條小笑臉狗狗船型襪', required: true },
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
      { key: 'barcode', label: '商品條碼', type: 'text', placeholder: 'K2505', required: true },
      { key: 'name', label: '商品名稱', type: 'text', placeholder: '滿版立體線條小笑臉狗狗船型襪', required: true },
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
  {
    key: 'new-product-launch',
    name: '🚀 新品上架一條龍',
    description: '從平拍照到全通路上架，一鍵完成素材生成 + 人工確認 + 上架通知',
    inputSchema: [
      { key: 'barcode', label: '商品條碼', type: 'text', placeholder: 'K2505', required: true },
      { key: 'name', label: '商品名稱', type: 'text', placeholder: '滿版立體線條小笑臉狗狗船型襪', required: true },
      { key: 'category', label: '分類', type: 'text', placeholder: '例：襪子、內衣、配件', required: false },
      { key: 'productImage', label: '平拍照', type: 'image', required: true },
      { key: 'scene', label: '情境場景', type: 'text', placeholder: '如：咖啡廳、臥室、戶外草地', required: false },
    ],
    pipeline: {
      name: '新品上架一條龍',
      tasks: [
        // Step 1：並行啟動（無前置依賴）
        {
          id: 0,
          agent: 'product',
          action: 'product-intro',
          payload: {
            products: [
              {
                barcode: '{{input.barcode}}',
                name: '{{input.name}}',
                category: '{{input.category}}',
              },
            ],
          },
          dependsOn: [],
        },
        {
          id: 1,
          agent: 'marketing',
          action: 'generate-image',
          payload: {
            productImageBase64: '{{input.productImage}}',
            style: '韓系實穿照',
          },
          dependsOn: [],
        },
        {
          id: 2,
          agent: 'marketing',
          action: 'generate-scene',
          payload: {
            productImageBase64: '{{input.productImage}}',
            scene: '{{input.scene}}',
          },
          dependsOn: [],
        },
        {
          id: 3,
          agent: 'marketing',
          action: 'generate-image',
          payload: {
            productImageBase64: '{{input.productImage}}',
            style: '電商首圖/主圖，白底，專業商品照',
          },
          dependsOn: [],
        },

        // Step 2：文案 + 影片（需要商品簡介做為素材）
        {
          id: 4,
          agent: 'marketing',
          action: 'generate-copy',
          payload: {
            product: {
              name: '{{input.name}}',
              category: '{{input.category}}',
              features: ['{{task[0].result.result.intros[0].description}}'],
            },
          },
          dependsOn: [0],
        },
        {
          id: 5,
          agent: 'marketing',
          action: 'generate-video',
          payload: {
            product: {
              name: '{{input.name}}',
              description: '{{task[0].result.result.intros[0].description}}',
            },
          },
          dependsOn: [0],
        },

        // Step 3：人工確認節點（全素材到齊後）
        {
          id: 6,
          agent: 'assistant',
          action: 'notify',
          payload: {
            message:
              '📦 新品素材已全部生成完成！\n\n商品：{{input.barcode}} {{input.name}}\n\n請確認素材是否 OK，確認後將通知上架人員。',
          },
          dependsOn: [1, 2, 3, 4, 5],
          requireConfirmation: true,
          confirmMessage: '新品 {{input.name}} 的所有素材已準備完成，是否交付上架人員？',
        },

        // Step 4：通知上架人員（含商品簡介全文）
        {
          id: 7,
          agent: 'assistant',
          action: 'notify',
          payload: {
            message:
              '🚀 新品上架通知\n\n品項：{{input.barcode}} {{input.name}}\n分類：{{input.category}}\n\n📝 商品簡介：{{task[0].result.result.intros[0].title}}\n{{task[0].result.result.intros[0].description}}\n{{task[0].result.result.intros[0].highlights}}\n\n請上架到：蝦皮、官網、Shop2000\n\n素材已準備完成，請查收。',
          },
          dependsOn: [6],
        },
      ],
    },
  },
];

// JSON 字串內部合法跳脫（塞進 "..." 位置的值）
// 用 JSON.stringify 後切掉外層引號，可正確處理 "、\、換行、Unicode 等
function jsonEscape(s: string): string {
  return JSON.stringify(s).slice(1, -1);
}

// 把 template 的 {{input.xxx}} 替換成實際輸入
// 替換發生在「JSON 字串」層級，值必須先跳脫，才不會破壞 JSON 合法性（尤其是 base64 裡的 / 或 = 不會有問題，但若值中有 " 或 \ 就會壞）
export function instantiateTemplate(
  template: PipelineTemplate,
  input: Record<string, string>
): Pipeline {
  const json = JSON.stringify(template.pipeline);
  const filled = json.replace(/\{\{input\.([^}]+)\}\}/g, (_, key) =>
    jsonEscape(input[key] ?? '')
  );
  return JSON.parse(filled);
}
