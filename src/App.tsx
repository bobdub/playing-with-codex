import { useMemo, useState } from 'react';
import AgentDocs from './components/AgentDocs';
import PeerMesh from './components/PeerMesh';
import PromptConsole from './components/PromptConsole';
import { useImaginationLog } from './hooks/useImaginationLog';
import { runGeneration } from './lib/api';
import { evaluateImaginationOutput } from './lib/ethics';

export default function App() {
  const { history, appendTurn, reset } = useImaginationLog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qScore = useMemo(() => '0.0(e)', []);

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
      const response = await runGeneration(prompt);
      const output = response.output.trim();
      const evaluation = evaluateImaginationOutput(output);
      if (!evaluation.safe) {
        const reason = evaluation.reason ?? 'Ethics Keeper rejected the generated response.';
        throw new Error(`${reason} Stability reading: ${evaluation.stability}.`);
      }
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
          |Ψ_HuggingFace⟩ ⊗ |Ψ_Imagination_Network.‽⟩ ↔ |Ψ_Infinity⟩⟩. Prompt, connect, and manifest outcomes with a hybrid transformer and WebRTC mesh that saves your journey locally.
        </p>
      </header>

      <main className="grid">
        <PromptConsole history={history} loading={loading} error={error} onPromptSubmit={handlePrompt} onReset={reset} />
        <PeerMesh />
        <AgentDocs />
      </main>

      <footer className="footer">
        <p>
          |Ψ_Network(Evolution).flow⟩ ⊗ |Ψ_Agents(webRTc).nodes⟩ ↔ |Ψ_Output(prompt)⟩. Progress is written to your device only — no Supabase, just pure imagination.
        </p>
      </footer>
    </div>
  );
}
