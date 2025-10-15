export interface GenerationResponse {
  output: string;
  model: string;
}

export async function runGeneration(prompt: string): Promise<GenerationResponse> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Generation failed');
  }

  return (await response.json()) as GenerationResponse;
}
