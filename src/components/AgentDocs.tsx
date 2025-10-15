import { formatMetricsSummary, type GenerationMetrics } from '../lib/metrics';

interface AgentDocsProps {
  qScore: string;
  lastMetrics: GenerationMetrics | null;
}

const agents = [
  {
    id: 'dream-catalyst',
    title: 'Ψ_Dream Catalyst',
    role: 'Runs FLAN-T5 locally through transformers.js to materialise prompts without a server.',
    interface: 'Bootstraps from CDN on first use. Generates responses directly inside the browser sandbox.'
  },
  {
    id: 'ethics-keeper',
    title: 'Ψ_Ethics Keeper',
    role: 'Evaluates the coherence and responsibility of generated responses before they reach explorers.',
    interface: 'Runs locally in App logic. Rejects or annotates outputs that break guardrails.'
  },
  {
    id: 'mesh-weaver',
    title: 'Ψ_Mesh Weaver',
    role: 'Maintains peer-to-peer connectivity for remote imagination nodes.',
    interface: 'WebRTC data-channel handshake with manual signalling and live metric synchronisation.'
  }
];

export default function AgentDocs({ qScore, lastMetrics }: AgentDocsProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <h2 className="panel__title">Agent Codex</h2>
          <p className="panel__subtitle">
            Dedicated agent documentation for the Imagination Network. Every agent operates locally, composable, and observable.
          </p>
        </div>
      </header>
      <div className="docs">
        {agents.map((agent) => (
          <article key={agent.id} className="docs__card">
            <h3>{agent.title}</h3>
            <p className="docs__role">{agent.role}</p>
            <p className="docs__interface">Interface: {agent.interface}</p>
            <p className="docs__metric">Quantum Stability: {qScore}</p>
            <p className="docs__metric docs__metric--detail">
              {lastMetrics ? `Last Effort: ${formatMetricsSummary(lastMetrics)}` : 'Awaiting first dream execution.'}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
