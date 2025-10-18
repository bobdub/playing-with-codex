# Project Plan · Imagination Network

## Current State Assessment

- **Interface** – A static HTML landing page served from `public/index.html` with progressive-enhancement JavaScript in `public/app.js`. Users can log prompts locally, browse a generated knowledge index, interact with a lightweight “neural terminal,” and transmit hero prompts to a configured Qwen2.5 Coder `/chat` endpoint with live status feedback.
- **Data layer** – No live persistence beyond `localStorage`; `docs/knowledge-index.json` is a generated artifact that must be refreshed manually with `npm run build:index`.
- **Backend & services** – There is no running API, agent runtime, or vector/graph database. The TypeScript sources in `src/` only power offline documentation tooling.
- **Deployment** – The site ships as static assets. There is no CI/CD pipeline, container image, or infrastructure as code.
- **Qwen gateway** – The hero prompt expects a reverse proxy (default: `/api/qwen`) that forwards `/health` and `/chat` calls to the Qwen2.5 Coder service. Operators can override the base URL with `data-llm-*` attributes on the form or `window.CODER_BASE_URL`; without the gateway the UI reports the model as offline.

The legacy roadmap assumed a fully featured AI operating system with real-time cognition. The repository currently delivers an informative brochure-style experience without the supporting services that the earlier phases implied.

## Gap Analysis vs. Legacy Plan

1. **Missing runtime architecture** – No FastAPI backend, agent bus, or Neo4j/Faiss persistence exists. Those pieces must be designed from scratch.
2. **Limited LLM integration** – The hero prompt now connects to Qwen2.5 Coder, but landing portal pulses remain local and no other surfaces consume generated reflections.
3. **Ethics & moderation layer** – No filtering mechanisms are implemented beyond the poetic copy within the UI.
4. **Terminal simulation** – The “neural terminal” echoes static commands and has no backend to execute imagination syntax.
5. **Operational tooling** – No tests, observability, or deployment automation are defined.

Given these gaps, the roadmap needs to ground itself in iterative, shippable milestones that respect the existing static foundation while paving a path toward intelligent services.

## Qwen Bridge Overview

- The hero prompt targets a configurable Qwen gateway (default: `/api/qwen`), expecting `/health` and `/chat` endpoints that mirror the FastAPI service installed via `scripts/install_qwen_coder_service.sh`.
- Runtime overrides are available through the form’s `data-llm-base` attribute or by setting `window.CODER_BASE_URL` before `public/app.js` executes, allowing environment-specific routing without rebuilding assets.
- When the gateway is unreachable, the UI surfaces explicit offline messaging and logs warnings to the neural terminal so contributors understand why responses are unavailable.
- Successful calls stream the full Qwen2.5 Coder reflection into the hero, record token counts in the terminal log, and maintain accessibility by disabling inputs while requests are in flight.

## Updated Phase Roadmap

### Phase 1 · Interface Foundations & Knowledge Surface
**Outcome:** Deliver an accessible, content-rich portal that clearly communicates the Imagination Network concept, captures pulses locally, and visualises knowledge-index data.

1. **Experience audit & design refresh** – Document current flows, improve hero/landing content, add responsive layout primitives, and surface live prompt/node metrics.
2. **Client-side data services** – Harden local persistence (schema versioning, export/import), improve search/filter UX, and expand empty-state guidance.
3. **Knowledge index storytelling** – Render highlights from `docs/knowledge-index.json`, add documentation deep links, and expose update timestamps so contributors know when to regenerate artifacts.
4. **Qwen handshake** – Provide resilient error messaging, document gateway configuration, and surface responses without blocking other UI flows.

> _Success Criteria:_ Lighthouse-accessible homepage, basic analytics (pulses + nodes) rendered from live data, clear calls to action that align with the broader roadmap, and a Qwen health indicator gating hero responses with live reflections when the model is reachable.

### Phase 2 · API Gateway & Dream Node Service
**Outcome:** Introduce the first backend service that accepts pulses, persists them, and exposes knowledge-index queries.

1. Define a FastAPI (or equivalent) service with persistence (SQLite/Postgres) for pulses and topic metadata.
2. Replace local-only storage with API calls, including optimistic UI updates and error handling.
3. Add authentication scaffolding (API key or session token) and rate limiting to prepare for public interaction.

> _Success Criteria:_ Deployed API with automated tests, frontend consuming live endpoints, and a repeatable deployment script (Docker + CI job).

### Phase 3 · Agent Orchestration & Ethics Layer
**Outcome:** Layer in orchestrated cognition features while maintaining safety guarantees.

1. Design modular agent services (Dream, Ethics, Entity, Q) connected by an event bus or message queue.
2. Integrate an LLM for prompt expansion and dream-node creation, including embeddings stored in a vector database.
3. Implement the moderation/ethics pipeline gating agent responses before persistence.

> _Success Criteria:_ Demonstrable multi-agent interaction traceable through logs, moderated responses flowing to the UI, and documentation describing the ethical review flow.

### Phase 4 · Infinity OS Simulation (Stretch)
**Outcome:** Explore the original vision of an AI-powered operating system once the prior foundations are reliable.

1. Prototype imagination syntax execution in the backend terminal endpoint.
2. Support sandboxed agent “apps” (e.g., research assistant, dream visualiser) running within controlled resource boundaries.
3. Publish extension points for external contributors and capture telemetry for continuous learning.

## Cross-Cutting Workstreams

- **Documentation:** Maintain living architecture diagrams, update onboarding instructions, and record regeneration steps for the knowledge index.
- **Testing & Quality:** Introduce linting/unit tests in TypeScript, add UI snapshot tests, and set expectations for manual QA around creative interactions.
- **Community & Ethics:** Define contribution guidelines emphasising safety, tone, and respectful imaginative exploration.

This refocused plan turns the poetic ambition of the Imagination Network into a set of grounded, iterative deliverables while preserving space for future expansion.
