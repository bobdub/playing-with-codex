# Qwen2.5 Coder Service Installation Guide

This guide installs the Qwen2.5-Coder-32B-Instruct model as a self-hosted FastAPI service inside the Imagination Network environment. It adapts the quickstart recommendations from [Hugging Face](https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct) into an automated workflow for the Aurora image.

## Prerequisites

* Build or provision an Imagination Network host using the `imagination-network-os` blueprint.
* Ensure outbound network access to `huggingface.co`. Provide a Hugging Face access token only if your mirror requires authentication.
* Log in as a privileged user (e.g. `aurora`) with `sudo` rights.

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
   * scaffold a FastAPI service that exposes `/health` and `/chat` endpoints backed by `Qwen/Qwen2.5-Coder-32B-Instruct` with conservative defaults of `temperature=0.2` and `max_new_tokens=4096`.
4. Populate the optional Hugging Face credentials if your environment needs them:
   ```bash
   sudoedit /opt/qwen-coder-service/qwen-coder.env
   ```
   Set the `HF_TOKEN` value to your personal access token when authentication is required, or leave it blank for anonymous downloads.
5. Start the service (if the installer did not already do so because `HF_TOKEN` was empty):
   ```bash
   sudo systemctl enable --now qwen-coder.service
   sudo systemctl status qwen-coder.service
   ```

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
  "tokens_generated": 120
}
```

If the call times out, ensure the host satisfies the VRAM requirements for a 32B model or reduce the `QWEN_DEFAULT_MAX_NEW_TOKENS` value in `/opt/qwen-coder-service/qwen-coder.env`.

## Operational notes

* The unit writes logs to `/opt/qwen-coder-service/logs/service.log`. Rotate or ship the file according to your observability standards.
* Pin to a different Qwen release by editing `QWEN_MODEL_NAME` in the environment file and running `sudo systemctl restart qwen-coder.service`.
* The FastAPI wrapper lives at `/opt/qwen-coder-service/qwen_service.py`. Extend it with guardrails, prompt templates, or vector store lookups to match your network policies.
