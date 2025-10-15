const agents = [
  {
    id: 'dream-catalyst',
    title: 'Ψ_Dream Catalyst',
    role: 'Turns raw prompts into scenario seeds using Hugging Face transformers.',
    interface: 'Invoked by /api/generate. Returns transformer completions to the console and mesh nodes.'
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
    interface: 'WebRTC data-channel handshake with optional manual signaling.'
  }
];

export default function AgentDocs() {
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
            <p className="docs__metric">Quantum Stability: 0.0(e)</p>
          </article>
        ))}
      </div>
    </section>
  );
}
