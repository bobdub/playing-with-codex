# Kwaipilot Agent Installation Guide

This guide describes how to install the Kwaipilot KAT-Dev-72B-Exp large language model agent inside the Imagination Network environment. It adapts the quickstart steps from [`docs/Kwaipilot.md`](Kwaipilot.md) into an automated deployment workflow for the Aurora image.

## Prerequisites

* Build or provision an Imagination Network host using the `imagination-network-os` blueprint.
* Ensure outbound network access to `huggingface.co`. Provide a Hugging Face access token only if your mirror requires authentication.
* Log in as a privileged user (e.g. `aurora`) with `sudo` rights.

## Installation steps

1. Transfer the repository onto the target host (e.g. `git clone https://example/playing-with-codex.git`).
2. Copy the installer onto the host filesystem and make it executable:
   ```bash
   sudo cp playing-with-codex/scripts/install_kwaipilot_agent.sh /tmp/
   sudo chmod +x /tmp/install_kwaipilot_agent.sh
   ```
3. Execute the installer as root:
   ```bash
   sudo /tmp/install_kwaipilot_agent.sh
   ```
   The script will:
   * create a dedicated `kwaipilot` system account and `/opt/kwaipilot-agent` home;
   * build a Python virtual environment and install `transformers`, `accelerate`, and the other libraries listed in the Kwaipilot quickstart; and
   * scaffold a FastAPI service that exposes `/health` and `/chat` endpoints backed by `KAT-Dev-72B-Exp` with the recommended `temperature=0.6` and `max_new_tokens=65536` defaults.
4. Populate the optional Hugging Face credentials if your environment needs them:
   ```bash
   sudoedit /opt/kwaipilot-agent/kwaipilot-agent.env
   ```
   Set the `HF_TOKEN` value to your personal access token when authentication is required, or leave it blank for anonymous downloads.
5. Start the service:
   ```bash
   sudo systemctl enable --now kwaipilot-agent.service
   sudo systemctl status kwaipilot-agent.service
   ```

## Validating the deployment

After the service reports `active (running)`, issue a smoke test from another terminal or bastion host:

```bash
curl -X POST \
  http://aurora-core:8080/chat \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "Give me a short introduction to large language models."}'
```

A successful response returns JSON similar to the following:

```json
{
  "response": "Large language models (LLMs) are transformer-based neural networks trained ...",
  "tokens_generated": 128
}
```

If the call times out, ensure that the target machine satisfies the hardware requirements for a 72B parameter model or reduce the `KWAI_DEFAULT_MAX_NEW_TOKENS` value in `/opt/kwaipilot-agent/kwaipilot-agent.env`.

## Operational notes

* The unit writes logs to `/opt/kwaipilot-agent/logs/service.log`. Rotate or ship the file according to your observability standards.
* You can pin to a different Kwaipilot release by editing `KWAI_MODEL_NAME` in the environment file and running `sudo systemctl restart kwaipilot-agent.service`.
* The FastAPI wrapper lives at `/opt/kwaipilot-agent/kwaipilot_agent.py`. Extend it with guardrails, prompt templates, or vector store lookups to match your network policies.
