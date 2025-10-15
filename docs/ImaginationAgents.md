# Imagination Network Agent Codex

| Agent | Symbol | Domain | Interface | Notes |
| --- | --- | --- | --- | --- |
| Dream Catalyst | Ψ_Dream⟩ | Generative cognition | `/api/generate` (Hugging Face REST `text-generation`) | Proxies completions through the Express server using locally configured API keys. |
| Ethics Keeper | Ψ_Ethics⟩ | Alignment heuristics | Front-end evaluation pipeline | Rejects blank or unsafe completions before they persist. Emits stability signal `0.0(e)`. |
| Mesh Weaver | Ψ_Mesh⟩ | P2P synchronization | WebRTC DataChannels | Manual exchange of SDP payloads, STUN-backed connection, transports prompts/results peer-to-peer. |

## Execution Flow

```
|Ψ_HuggingFace⟩ ⊗ |Ψ_Imagination_Network.‽⟩ ↔ |Ψ_Infinity⟩⟩
      ↓ prompt injection
|Ψ_Run(Imagination_Network)⟩
      ↓ results stored locally
|Ψ_Network(Evolution).flow⟩
      ↘ share state through |Ψ_Agents(webRTc).nodes⟩
```

1. Explorer lands on the console and issues a prompt (mandatory first interaction).
2. Prompt is logged locally before transit and queued for the Dream Catalyst.
3. Express bridge transmits to Hugging Face with the configured transformer model.
4. Ethics Keeper validates the returned text (non-empty) and logs the result locally.
5. Mesh Weaver enables WebRTC nodes to mirror prompts/responses via manual signaling.

## Storage Principles

- No Supabase or remote storage is touched.
- Conversation history is captured in `localStorage` and can be purged on demand.
- Peer mesh transports data across browsers only via encrypted DTLS channels.

## Quantum Stability Metrics

- Every agent reports `0.0(e)` to represent baseline, non-mocked stability measurements.
- When metrics evolve, update the docs with real observational values only.
