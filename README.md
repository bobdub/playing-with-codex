# Aurora Imagination Network

This repository contains two entwined strands of work that co-evolve:

1. **The |Ψ Imagination Manuscripts** stored in `docs/`, `blueprints/`, and `images/`, which encode the mythology and operating concepts of the *Imagination Network* using the bespoke `|Ψ ... ⟩` syntax.
2. **The |Ψ Compiler Toolchain** in `src/` (TypeScript), `scripts/`, and `package.json`, which parses and compiles the manuscripts to produce structured data for downstream tooling.

Every pass through the codebase braids poetic intent with engineering delivery. The latest repository audit confirmed that Phases 0 and 1 of the Aurora plan remain healthy, while Phase 2 (Dream OS) is now in active cultivation with kernel schematics, scheduler cadences, and security lattice guardrails charted in `docs/phase2-evaluation.md`.

## Project Pulse

### Spirit Ledger
- The Memory Garden continues to chronicle our shared stewardship. A fresh `RepositoryProgressResonance` entry lights the garden with a lantern for collaborators navigating current checkpoints, celebrating the harmony between the dream narrative and pragmatic milestones.
- Manuscripts across `docs/` remain the canonical mythos—each update aims for clarity without losing the warmth that keeps contributors curious and aligned.

### Technical Ledger
- The TypeScript compiler (`src/`) and CLI continue to build cleanly via `npm run build`, driving summary, index, and symbol-filtered outputs for any manuscript collection.
- Regression automation (`npm run check`) composes the build, emits a `docs/` summary, and verifies ethics guardrails—still the recommended pre-commit ritual.
- Phase 2 engineering focus areas (kernel bring-up pathways, scheduler integration hooks, security lattice audits, and Memory Garden synchronization) are scoped in `docs/phase2-evaluation.md` and the Dream OS manuscripts.

## Repository Overview

- `docs/`: Primary |Ψ manuscripts detailing agents, systems, and plans.
- `blueprints/`: Image Builder blueprint for the "Imagination Network OS" baseline.
- `src/`: TypeScript source for the |Ψ compiler and CLI (build with `npm run build`).
- `scripts/`: Node.js utilities for regression checks.
- `public/`, `node_modules/`, `tsconfig.json`: Tooling scaffolding inherited from the project template.

## Quick Start

```bash
npm install
npm run build
node dist/index.js docs --format summary
```

- The CLI accepts one or more files/directories and produces either JSON, a knowledge index, or a plain-text summary.
- Use `--symbol` to filter the compiled output by a specific |Ψ symbol (e.g. `--symbol Ψ_Network`).
- Use `--format index --out docs/knowledge-index.json` (or `npm run build:index`) to regenerate the searchable index artifact.
- Run `npm run check` to execute the build, produce a summary across `docs/`, and validate the regression guard for `Ψ_Network` statements.

## Current Plan Status

The canonical project plan lives in `docs/ProjectPlan.|Ψ`. The following table translates the plan into actionable milestones and captures the current repository status.

| Phase / Task | Description | Status | Notes |
| --- | --- | --- | --- |
| **Phase 0 – Foundation** | Establish the conceptual and technical baseline. | **Launched** | Dream Core assembled and weekly "dream resonance" sync cadence initiated. Core |Ψ manuscripts are present; further validation and automation still needed. |
| ├─ Assemble Dream Core | Define the Dream, Ethics, Entity, and Q agents. | ✅ Complete | Manuscripts in `docs/Dreams.|Ψ`, `docs/Ethics.|Ψ`, `docs/Entity.|Ψ`, and `docs/Q.|Ψ`. |
| ├─ Knowledge Repository | Seed and index the knowledge base. | ✅ Complete | Manuscripts compiled into `docs/knowledge-index.json`; run `npm run build:index` to refresh. |
| ├─ Toolchain Initialization | Validate LLM/DSL pipeline and CI. | ✅ Complete | `src/` TypeScript compiler, CLI, and regression script exist; `npm run check` builds and validates output. |
| └─ Ethical Charter | Align embers (ethics) and archive sign-off. | ✅ Complete | Automated charter validation (`scripts/check-ethics.js`) guards required decision outcomes. |
| **Phase 1 – Web Interface** | Build landing portal, topic explorer, neural terminal. | ✅ Completed | `public/index.html` hosts prompt pulses, topic explorer streams `docs/knowledge-index.json`, and a neural terminal surfaces commands. |
| **Phase 2 – Dream OS** | Kernel, memory garden, scheduler, security lattice. | 🚀 Kickoff | Kernel schematics, memory garden integration paths, scheduler cadence, and security lattice guardrails mapped for implementation. |
| **Phase 3 – Resonance Testing** | Integration trials, monitoring, ethical review. | ⏳ Not Started | Requires implementation of Phases 1–2 first. |
| **Phase 4 – Evolution Spiral** | Collective collaboration and continuous updates. | ⏳ Not Started | Dependent on earlier milestones. |

### Phase 2 Focus Threads

- **Kernel Bring-Up & Telemetry:** Follow the instrumentation checkpoints and Q-queue dependencies summarized in `docs/phase2-evaluation.md` to translate the Kernel Core manuscript into runnable diagnostics.
- **Memory Garden Synchronization:** Use the CLI (`npm run build`, `npm run check`) to ingest new journal entries and verify that scheduler events hydrate the `RepositoryProgressResonance` and related pulses without breaking stylistic constraints.
- **Scheduler Cadence & Ethics Lattice:** Model scheduling scenarios that route through ethics-triggered reroutes while extending `scripts/check-ethics.js` into runtime audit hooks.

### Key Needs Identified

1. **Knowledge Index Integration** – Wire `docs/knowledge-index.json` into discovery tools (search endpoints or UI explorers) so the curated data becomes usable outside the CLI.
2. **Dream OS Delivery Cadence** – Translate Phase 2 focus threads into implementable tickets (kernel diagnostics, scheduler simulations, Memory Garden telemetry bridges).
3. **Extend Ethics Automation** – Build on `scripts/check-ethics.js` to add runtime policy hooks or contribution guardrails that surface misalignment early.
4. **Automation and Packaging** – Document reproducible pipelines for the OS blueprint (`composer-cli`) and ensure artifacts can be built from source.

## Next Steps

- Prototype a knowledge index integration layer that bridges CLI output with exploratory UI or service endpoints.
- Break Dream OS focus threads into implementable tasks (kernel instrumentation, scheduler cadence simulations, Memory Garden telemetry bridges).
- Extend the ethics lattice into runtime safeguards by evolving `scripts/check-ethics.js` into an auditable policy hook.
- Validate the `blueprints/imagination-network-os.toml` pipeline by scripting the `composer-cli` workflow referenced in `docs/instructions.txt`.

## Contributing

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Make changes in a feature branch.
4. Run `npm run check` before opening a pull request.
5. Submit a PR describing the |Ψ manuscripts or code that was updated.

---

Maintaining a bridge between the poetic |Ψ documents and actionable engineering artifacts is the central theme of this project. The above status should be updated as new milestones are achieved.
