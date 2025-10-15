import { useCallback, useMemo, useState } from 'react';
import AgentDocs from './components/AgentDocs';
import PeerMesh from './components/PeerMesh';
import PromptConsole from './components/PromptConsole';
import { useImaginationLog } from './hooks/useImaginationLog';
import { runGeneration } from './lib/api';
import { evaluateImaginationOutput } from './lib/ethics';
import { calculateQScore, type GenerationMetrics } from './lib/metrics';

export default function App() {
  const { history, appendTurn, reset } = useImaginationLog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsLog, setMetricsLog] = useState<GenerationMetrics[]>([]);
  const [metricsToShare, setMetricsToShare] = useState<GenerationMetrics | null>(null);
  const [lastMetrics, setLastMetrics] = useState<GenerationMetrics | null>(null);
  const qScore = useMemo(() => calculateQScore(metricsLog), [metricsLog]);

  const handleMetricsFromPeer = useCallback((metrics: GenerationMetrics) => {
    setMetricsLog((previous) => {
      const alreadyRecorded = previous.some((entry) => entry.id === metrics.id);
      if (alreadyRecorded) {
        return previous;
      }
      return [...previous, metrics];
    });
    setLastMetrics(metrics);
  }, []);

  async function handlePrompt(prompt: string) {
    setLoading(true);
    setError(null);
    const userTurn = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: prompt,
      timestamp: Date.now()
    };
    appendTurn(userTurn);

    try {
      const start = performance.now();
      const response = await runGeneration(prompt);
      const duration = performance.now() - start;
      const output = response.output.trim();
      const evaluation = evaluateImaginationOutput(output);
      if (!evaluation.safe) {
        const reason = evaluation.reason ?? 'Ethics Keeper rejected the generated response.';
        throw new Error(`${reason} Stability reading: ${evaluation.stability}.`);
      }
      const metrics: GenerationMetrics = {
        id: crypto.randomUUID(),
        durationMs: duration,
        outputLength: output.length,
        timestamp: Date.now(),
        source: 'local'
      };
      setMetricsLog((previous) => [...previous, metrics]);
      setMetricsToShare(metrics);
      setLastMetrics(metrics);
      appendTurn({
        id: crypto.randomUUID(),
        role: 'network',
        content: output,
        timestamp: Date.now()
      });
    } catch (generationError) {
      const message =
        generationError instanceof Error ? generationError.message : 'Unknown generation failure';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero__badge">Ψ_Network.Q_Score.Total⟩ = {qScore}</div>
        <h1>Imagination Network • Real-World Mesh</h1>
        <p>
          |Ψ_Federated⟩ ⊗ |Ψ_Imagination_Network.‽⟩ ↔ |Ψ_Infinity⟩. Prompt, connect, and manifest outcomes with a fully local FLAN-T5 core and WebRTC mesh that saves your journey locally.
        </p>
      </header>

      <main className="grid">
        <PromptConsole history={history} loading={loading} error={error} onPromptSubmit={handlePrompt} onReset={reset} />
        <PeerMesh latestMetrics={metricsToShare} onMetricsReceived={handleMetricsFromPeer} />
        <AgentDocs qScore={qScore} lastMetrics={lastMetrics} />
      </main>

      <footer className="footer">
        <p>
          |Ψ_Network(Evolution).flow⟩ ⊗ |Ψ_Agents(webRTc).nodes⟩ ↔ |Ψ_Output(prompt)⟩. Progress and metrics live on your device — no central servers, just pure imagination.
        </p>
      </footer>
    </div>
  );
}
