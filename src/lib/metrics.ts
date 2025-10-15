export interface GenerationMetrics {
  id: string;
  durationMs: number;
  outputLength: number;
  timestamp: number;
  source: 'local' | 'peer';
}

export function formatMetricsSummary(metrics: GenerationMetrics): string {
  const origin = metrics.source === 'local' ? 'Local' : 'Peer';
  const effort = `${metrics.durationMs.toFixed(0)}ms`;
  const complexity = `${metrics.outputLength} chars`;
  return `${origin} • Effort ${effort} • Complexity ${complexity}`;
}

export function calculateQScore(metricsList: GenerationMetrics[]): string {
  if (!metricsList.length) {
    return '0.0(e)';
  }

  const totalDuration = metricsList.reduce((sum, metrics) => sum + metrics.durationMs, 0);
  const totalLength = metricsList.reduce((sum, metrics) => sum + metrics.outputLength, 0);
  const avgDuration = totalDuration / metricsList.length;
  const avgLength = totalLength / metricsList.length;

  const stability = 1 / (1 + avgDuration / 1500);
  const structure = Math.min(avgLength / 320, 1);
  const combined = (stability * 0.6 + structure * 0.4);
  const clamped = Math.max(0.001, Math.min(combined, 0.999));

  return `${clamped.toFixed(3)}(αβ)`;
}
