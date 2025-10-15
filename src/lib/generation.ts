import type { GenerationResponse } from './api';

const MODEL_ID = 'Xenova/flan-t5-small';
const TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.1/dist/transformers.min.js';

interface Text2TextGenerationOutput {
  generated_text?: string;
}

export type Text2TextGenerationPipeline = (
  prompt: string,
  options?: Record<string, unknown>
) => Promise<Text2TextGenerationOutput[] | Text2TextGenerationOutput>;

interface TransformersRuntime {
  pipeline: (task: string, model: string) => Promise<Text2TextGenerationPipeline>;
}

declare global {
  interface Window {
    transformers?: TransformersRuntime;
  }
}

let transformersLoadPromise: Promise<TransformersRuntime> | null = null;
let generatorPromise: Promise<Text2TextGenerationPipeline> | null = null;

async function ensureTransformersRuntime(): Promise<TransformersRuntime> {
  if (typeof window === 'undefined') {
    throw new Error('Transformers runtime is only available in the browser environment.');
  }

  if (window.transformers) {
    return window.transformers;
  }

  if (!transformersLoadPromise) {
    transformersLoadPromise = new Promise<TransformersRuntime>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-transformers-runtime]');
      if (existing) {
        if (existing.dataset.transformersReady === 'true' && window.transformers) {
          resolve(window.transformers);
          return;
        }
        existing.addEventListener('load', () => {
          if (window.transformers) {
            resolve(window.transformers);
          } else {
            reject(new Error('Transformers runtime did not initialise after loading.'));
          }
        });
        existing.addEventListener('error', () => {
          reject(new Error('Failed to load the transformers runtime from the CDN.'));
        });
        return;
      }

      const script = document.createElement('script');
      script.src = TRANSFORMERS_CDN;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.transformersRuntime = 'true';
      script.onload = () => {
        script.dataset.transformersReady = 'true';
        if (window.transformers) {
          resolve(window.transformers);
        } else {
          reject(new Error('Transformers runtime failed to initialise.'));
        }
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('Unable to load transformers runtime from CDN.'));
      };

      document.head.appendChild(script);
    });
  }

  try {
    return await transformersLoadPromise;
  } catch (error) {
    transformersLoadPromise = null;
    throw error;
  }
}

async function getGenerator(): Promise<Text2TextGenerationPipeline> {
  if (!generatorPromise) {
    const runtime = await ensureTransformersRuntime();
    generatorPromise = runtime.pipeline('text2text-generation', MODEL_ID);
  }

  return generatorPromise;
}

export interface LocalGenerationOptions {
  maxNewTokens?: number;
  temperature?: number;
}

export async function generateLocally(
  prompt: string,
  options: LocalGenerationOptions = {}
): Promise<GenerationResponse> {
  const engine = await getGenerator();
  const { maxNewTokens = 128, temperature = 0.7 } = options;
  const outputs = await engine(prompt, {
    max_new_tokens: maxNewTokens,
    temperature,
    return_full_text: false
  });

  const first = Array.isArray(outputs) ? outputs[0] : outputs;
  const generated = first?.generated_text ?? '';

  return {
    output: generated,
    model: MODEL_ID
  };
}
