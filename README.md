# Imagination Network • Real-World Mesh

A mobile-ready exploration interface that weaves together Hugging Face transformers, WebRTC peer-to-peer nodes, and dedicated agent documentation. Progress is stored locally to honor privacy while enabling collaborative AGI prototyping.

## Features

- **Immediate prompting** – the landing console requests input on load so explorers can entangle with the network instantly.
- **Hugging Face integration** – a lightweight Express server proxies text generation requests to the Hugging Face Inference API. Set your `HUGGING_FACE_API_KEY` and optional `HUGGING_FACE_MODEL`.
- **WebRTC dream nodes** – create offers, answers, and peer-to-peer data channels with manual signaling to synchronize imagination states without centralized storage.
- **Dedicated agent docs** – on-page reference describing the Dream Catalyst, Ethics Keeper, and Mesh Weaver agents.
- **Local persistence** – conversation history is written to `localStorage`; clearing memory happens entirely on-device.
- **Mobile-first styling** – responsive glassmorphism UI optimized for phones and large displays.
- **Optional local sampling** – a Python helper script loads the `microsoft/UserLM-8b` transformer for experiments outside the web UI.

## Getting Started

```bash
npm install
```

### Run the Hugging Face bridge

```bash
HUGGING_FACE_API_KEY=your_key npm run server
```

Optionally set `HUGGING_FACE_MODEL` (defaults to `gpt2`). The server listens on port `4000` by default.

### Launch the interface

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start prompting. The Vite dev server proxies `/api` to the local Express bridge.

### Build for production

```bash
npm run build
```

This runs the TypeScript checker and produces static assets in `dist/`.

### Sample the microsoft/UserLM-8b model locally

Install the Python dependencies in your preferred environment and run the helper script:

```bash
pip install torch transformers
python scripts/userlm_sequence.py --device cuda
```

The script reproduces the system prompt shared in the repository issues and blocks `<|endconversation|>` tokens so the generated description of the sequence stays focused. Override `--model-path`, `--top-p`, `--temperature`, or `--max-new-tokens` to experiment with different settings.

## Environment variables

- `HUGGING_FACE_API_KEY` (required) – personal token used against the Hugging Face REST inference endpoint.
- `HUGGING_FACE_MODEL` (optional) – override the default model.
- `PORT` (optional) – customize the server port.

## Project structure

```
├── docs
│   └── ImaginationAgents.md
├── server
│   └── index.js
├── src
│   ├── App.tsx
│   ├── components
│   │   ├── AgentDocs.tsx
│   │   ├── PeerMesh.tsx
│   │   └── PromptConsole.tsx
│   ├── hooks
│   │   └── useImaginationLog.ts
│   ├── lib
│   │   └── api.ts
│   └── styles
│       └── global.css
├── index.html
└── package.json
```

## Agent reference

A detailed description of each agent, responsibilities, and operational flow lives in [`docs/ImaginationAgents.md`](docs/ImaginationAgents.md).
