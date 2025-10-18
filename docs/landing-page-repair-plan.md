# Landing Page Repair Plan: Unblocking the Gateway and Smoothing Everyday Use

## Source Signals
- **Connection friction report** – Summaries of the hero prompt’s dependency on a pre-wired Qwen gateway, its brittle health checks, and the lack of actionable remediation when `/chat` fails.【F:docs/landing-page-connection-issues.md†L3-L21】
- **Experience projection** – Inventory of landing-page ergonomics that still hinge on bare-minimum validation, opaque local storage, stale knowledge-index fetches, and the same gateway fragility the hero reports.【F:docs/landing-page-projection.md†L6-L25】

## Immediate Triage (Next Release)
1. **Embed a gateway setup checklist.** Add an expandable help block near the hero status banner that lists prerequisites (reverse proxy, `/health` response, `/chat` proxy) and links directly to the automation script so stewards see the fix when the channel is offline.【F:docs/landing-page-connection-issues.md†L5-L21】【F:docs/QwenGatewayBridge.md†L1-L102】
2. **Persist failed pulses for follow-up.** Cache prompts that encounter `/chat` errors and surface a retry UI so caretakers can re-send once the gateway is working, instead of losing the intent entirely.【F:docs/landing-page-connection-issues.md†L13-L18】【F:docs/landing-page-projection.md†L6-L17】
3. **Restore HTML validation & inline guidance.** Remove `novalidate` from the pulse form, provide accessible error summaries, and add contextual hints for tags/intensity to reduce friction before backend work begins.【F:docs/landing-page-projection.md†L6-L17】

## Short-Term Hardening (Following Iteration)
1. **Local storage stewardship.** Introduce schema versioning, export/delete affordances, and quota warnings so the prompt log reflects actual usage instead of silently truncating entries.【F:docs/landing-page-projection.md†L6-L17】
2. **Knowledge index freshness signal.** Display the timestamp from `docs/knowledge-index.json`, add a "refresh required" badge when fetches fail, and document `npm run build:index` directly on the page.【F:docs/landing-page-projection.md†L18-L21】
3. **Gateway diagnostics overlay.** Provide a modal that runs the health probe, shows the configured endpoints, and suggests overrides when auto-configuration fails, lowering the operational barrier described in the friction report.【F:docs/landing-page-connection-issues.md†L5-L21】

## Foundation for Phase 2
- **Automated gateway bootstrap.** Offer a downloadable configuration package (nginx snippet + script invocation) from the landing page after successful diagnostics, bridging the gap between UI and infrastructure guides.【F:docs/landing-page-connection-issues.md†L22-L26】【F:docs/QwenGatewayBridge.md†L110-L209】
- **Progressive backend migration.** Plan the transition from localStorage to the upcoming pulse API so that the retry queue and export tooling can switch to server-backed persistence with minimal UI disruption.【F:docs/landing-page-projection.md†L11-L25】

Deliverables for each slice should include updated user-facing documentation, terminal log entries describing recovery steps, and MemoryGarden reflections to maintain stewardship continuity.
