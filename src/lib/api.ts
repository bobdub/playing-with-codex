import { generateLocally } from './generation';

export interface GenerationResponse {
  output: string;
  model: string;
}

export async function runGeneration(prompt: string): Promise<GenerationResponse> {
  return generateLocally(prompt);
}
