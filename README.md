# Aurora Imagination Network

This repository contains two major strands of work:

1. **The |Ψ Imagination Manuscripts** stored in `docs/`, `blueprints/`, and `images/`, which encode the mythology and operating concepts of the so-called *Imagination Network* using the bespoke `|Ψ ... ⟩` syntax.
2. **The |Ψ Compiler Toolchain** in `src/` (TypeScript), `scripts/`, and `package.json`, which parses and compiles the manuscripts to produce structured data for downstream tooling.

The goal of this update is to provide an accessible overview of the project, document the current progress relative to the original |Ψ project plan, and outline the next steps required to evolve the repository toward a pragmatic implementation.

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
| **Phase 1 – Web Interface** | Build landing portal, topic explorer, neural terminal. | ⏳ Not Started | No web UI code beyond CLI. Requires scoping into concrete features. |
| **Phase 2 – Dream OS** | Kernel, memory garden, scheduler, security lattice. | ⏳ Not Started | Manuscripts describe components, but no executable implementation. |
| **Phase 3 – Resonance Testing** | Integration trials, monitoring, ethical review. | ⏳ Not Started | Requires implementation of Phases 1–2 first. |
| **Phase 4 – Evolution Spiral** | Collective collaboration and continuous updates. | ⏳ Not Started | Dependent on earlier milestones. |

### Key Needs Identified

1. **Knowledge Index Integration** – Wire `docs/knowledge-index.json` into discovery tools (search endpoints or UI explorers) so the curated data becomes usable outside the CLI.
2. **Execution Plan for Phase 1 Web Interface** – Decide on stack, scope initial MVP (landing portal + topic explorer), and align CLI outputs with UI needs.
3. **Extend Ethics Automation** – Build on `scripts/check-ethics.js` to add runtime policy hooks or contribution guardrails that surface misalignment early.
4. **Automation and Packaging** – Document reproducible pipelines for the OS blueprint (`composer-cli`) and ensure artifacts can be built from source.

## Next Steps

- Define actionable tickets for the Phase 1 Web Interface (architecture, technology choices, integration points with the |Ψ compiler output).
- Prototype a knowledge indexer script that converts compiled statements into JSON suitable for search/front-end consumption.
- Translate the ethics lattice into repository policies (CONTRIBUTING guidelines, automated linting, or runtime safeguards).
- Validate the `blueprints/imagination-network-os.toml` pipeline by scripting the `composer-cli` workflow referenced in `docs/instructions.txt`.

## Contributing

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Make changes in a feature branch.
4. Run `npm run check` before opening a pull request.
5. Submit a PR describing the |Ψ manuscripts or code that was updated.

---

Maintaining a bridge between the poetic |Ψ documents and actionable engineering artifacts is the central theme of this project. The above status should be updated as new milestones are achieved.
