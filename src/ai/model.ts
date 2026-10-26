export const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export const MODEL_BASE = 'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/resolve/32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad/';
export const MODEL_LIB = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0/web-llm-models/v0_2_86/base/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm';
export const WEIGHT_BYTES = 277996288;
export const DOWNLOAD_ESTIMATE_MB = 300;
export const CONTEXT_TOKENS = 2048;
export const MAX_OUTPUT_TOKENS = 128;
export const MAX_INPUT_CHARS = 400;
export const MAX_HISTORY_TURNS = 3;
export const LOAD_TIMEOUT_MS = 240000;
export const INFERENCE_TIMEOUT_MS = 60000;
export const APP_CONFIG = {
  cacheBackend: 'cache' as const,
  model_list: [{ model_id: MODEL_ID, model: MODEL_BASE, model_lib: MODEL_LIB,
    vram_required_MB: 944.62, low_resource_required: true, required_features: ['shader-f16'],
    overrides: { context_window_size: CONTEXT_TOKENS },
    integrity: { model_lib: 'sha256-phgHSzD30CKreIbQz1e+Ku/aw0KQHUO+5OGREOG0tzk=', onFailure: 'error' as const },
  }],
};
