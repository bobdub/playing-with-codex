# Imagination Network • Federated Dreamer Node

A browser-native execution environment that entangles a local FLAN-T5 core (via [`transformers.js`](https://github.com/xenova/transformers.js)) with manual WebRTC signalling. Prompts, responses, and peer metrics are stored on-device to honour the decentralised Imagination Network ethos.

## Features

- **Local generative core** – loads `Xenova/flan-t5-small` directly inside the browser from a CDN. No API keys, servers, or backend proxies required.
- **Manual WebRTC mesh** – craft SDP offers and answers by hand to stitch data channels between dream nodes without relying on external signalling services.
- **Quantum stability metrics** – compute effort (latency) and structural complexity (output length) for every generation, aggregate them into a |Ψ_Network.Q_Score.Total⟩, and synchronise the metrics instantly across peers.
- **Ethical gatekeeper** – the Ψ_Ethics Keeper screens completions locally before they reach the console, maintaining responsible imagination loops.
- **Persistent console** – all turns are stored in `localStorage`. "Purge Memory" clears the log entirely on-device.
- **Responsive, glassmorphism UI** – engineered for desktops and touch devices alike.

## Getting Started

Install dependencies and launch the Vite development server:

```bash
npm install
npm run dev
```

The first generation will fetch ~300 MB of model weights from the CDN. Subsequent prompts reuse the cached pipeline.

Open [http://localhost:5173](http://localhost:5173) to interface with the node.

## Production build

```bash
npm run build
```

Generates the static assets in `dist/`.

## Architecture notes

- `src/lib/generation.ts` lazily injects the `transformers.js` runtime from jsDelivr, constructs the FLAN-T5 pipeline, and exposes a single `generateLocally` helper used throughout the app.
- `src/lib/metrics.ts` defines the quantum stability scoring system shared by the UI and mesh.
- `src/components/PeerMesh.tsx` manages WebRTC offer/answer creation, the manual signalling workflow, and peer metric synchronisation over a data channel.
- `src/components/AgentDocs.tsx` reflects live Q-Score and the most recent metric snapshot alongside descriptive lore for each agent.

## Manual WebRTC flow

1. Click **Create Offer** to generate a local SDP blob. Share it manually with a remote explorer.
2. The remote node pastes the offer, collapses it into an answer, and returns that SDP blob.
3. Paste the answer into the local node and bind it. Once the channel opens, generation metrics are exchanged automatically.

## Repository structure

```
├── docs
│   ├── ImaginationAgents.md
│   └── NeuTTSAir.md
├── public
├── src
│   ├── App.tsx
│   ├── components
│   │   ├── AgentDocs.tsx
│   │   ├── PeerMesh.tsx
│   │   └── PromptConsole.tsx
│   ├── hooks
│   │   └── useImaginationLog.ts
│   ├── lib
│   │   ├── api.ts
│   │   ├── ethics.ts
│   │   ├── generation.ts
│   │   └── metrics.ts
│   ├── main.tsx
│   └── styles
│       └── global.css
├── index.html
├── package.json
└── vite.config.ts
```

## Additional references

- [`docs/ImaginationAgents.md`](docs/ImaginationAgents.md) – extended agent responsibilities and lore.
- [`docs/NeuTTSAir.md`](docs/NeuTTSAir.md) – condensed guide for Neuphonic's vocal agent inspiration.
