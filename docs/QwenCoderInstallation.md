# Qwen2.5 Coder Service Installation Guide

This guide installs the Qwen2.5-Coder-32B-Instruct model as a self-hosted FastAPI service inside the Imagination Network environment. It adapts the quickstart recommendations from [Hugging Face](https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct) into an automated workflow for the Aurora image.

## Prerequisites

* Build or provision an Imagination Network host using the `imagination-network-os` blueprint.
* Ensure outbound network access to `huggingface.co`. Provide a Hugging Face access token when your mirror requires authentication; export it as `HF_TOKEN` before running the provisioning helper to avoid storing it in shell history later.
* Log in as a privileged user (e.g. `aurora`) with `sudo` rights.
* Complete the [environment provisioning checklist](./QwenEnvironmentProvisioning.md) so the dedicated account, virtual environment, and dependencies are in place.

## Installation steps

1. Transfer the repository onto the target host (e.g. `git clone https://example/playing-with-codex.git`).
2. Copy the installer onto the host filesystem and make it executable:
   ```bash
   sudo cp playing-with-codex/scripts/install_qwen_coder_service.sh /tmp/
   sudo chmod +x /tmp/install_qwen_coder_service.sh
   ```
3. Execute the installer as root:
   ```bash
   sudo /tmp/install_qwen_coder_service.sh
   ```
   The script will:
   * create a dedicated `qwen` system account with `/opt/qwen-coder-service` as its home;
   * build a Python virtual environment and install `transformers`, `accelerate`, and the other libraries required by Qwen2.5 Coder; and
   * scaffold a FastAPI service that exposes `/health`, `/chat`, and `/metrics` endpoints backed by `Qwen/Qwen2.5-Coder-32B-Instruct` with conservative defaults of `temperature=0.2` and `max_new_tokens=4096`, and
   * register a `qwen-coder.service` unit that restarts automatically and streams structured JSON logs to `/opt/qwen-coder-service/logs/service.log`.
4. Confirm the Hugging Face credentials:
   * If you exported `HF_TOKEN` before running the provisioner, the installer has already written the token into `/opt/qwen-coder-service/qwen-coder.env` with permissions locked to `600`.
   * Otherwise, populate the value manually:
     ```bash
     sudoedit /opt/qwen-coder-service/qwen-coder.env
     ```
     Set `HF_TOKEN` to your personal access token when authentication is required, or leave it blank for anonymous downloads.
5. Verify the service status:
   ```bash
   sudo systemctl status qwen-coder.service
   ```
   The installer enables the unit automatically. If authentication is required later, populate `HF_TOKEN` and run `sudo systemctl restart qwen-coder.service`.
6. Bridge the API gateway so the portal can reach the service:
   ```bash
   sudo ./scripts/configure_qwen_gateway.sh
   ```
   Supply environment variables documented in [Qwen Gateway Bridge Guide](./QwenGatewayBridge.md) to point at remote hosts, enable HTTP basic authentication via `AUTH_HTPASSWD_FILE`, or tune rate limiting so the deployment aligns with your API service policies.

## Validating the deployment

After the service reports `active (running)`, issue a smoke test from another terminal or bastion host:

```bash
curl -X POST \
  http://aurora-core:8080/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Summarise the Imagination Network in three sentences."}'
```

A successful response returns JSON similar to the following:

```json
{
  "response": "The Imagination Network is a poetic-technical experiment...",
  "tokens_generated": 120,
  "tokens_per_second": 14.8,
  "latency_ms": 811.52
}
```

If the call times out, ensure the host satisfies the VRAM requirements for a 32B model or reduce the `QWEN_DEFAULT_MAX_NEW_TOKENS` value in `/opt/qwen-coder-service/qwen-coder.env`.

Follow the smoke test with the workflow harness to exercise real prompts end-to-end:

```bash
python3 scripts/validate_qwen_workflows.py \
  --base-url http://127.0.0.1:8080 \
  --report /tmp/qwen-validation/report.json
```

The harness reads `docs/QwenWorkflowValidationBaseline.json`, replays the curated prompts with `temperature=0.2`, enforces latency thresholds, and writes an optional JSON report for audit trails. Update the baseline file whenever kin-specific workflows evolve and see the [Workflow Validation Guide](./QwenWorkflowValidation.md) for deeper operational context.

## Operational notes

* The unit writes structured JSON logs to `/opt/qwen-coder-service/logs/service.log`. Rotate or ship the file according to your observability standards and ingest the latency, token, and GPU metadata for dashboards.
* Poll the `/metrics` endpoint for aggregated latency, throughput, and GPU telemetry; the payload is JSON so it can feed into Prometheus exporters or custom scrapers.
* See the [observability guide](./QwenMonitoring.md) for log field definitions, scraping patterns, and alerting suggestions.
* Pin to a different Qwen release by editing `QWEN_MODEL_NAME` in the environment file and running `sudo systemctl restart qwen-coder.service`.
* The FastAPI wrapper lives at `/opt/qwen-coder-service/qwen_service.py`. Extend it with guardrails, prompt templates, or vector store lookups to match your network policies.
* When redeploying or moving the service, re-run the [gateway bridge](./QwenGatewayBridge.md) steps so `/api/qwen` stays aligned with the active host.
