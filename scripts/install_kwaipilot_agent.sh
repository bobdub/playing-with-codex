#!/usr/bin/env bash
set -euo pipefail

MODEL_REPO="Kwaipilot/KAT-Dev-72B-Exp"
AGENT_USER="kwaipilot"
INSTALL_ROOT="/opt/kwaipilot-agent"
ENV_FILE="$INSTALL_ROOT/kwaipilot-agent.env"
SERVICE_FILE="/etc/systemd/system/kwaipilot-agent.service"
PYTHON_BIN="${PYTHON_BIN:-python3}"

log() {
  echo "[kwaipilot-installer] $*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

if [[ $EUID -ne 0 ]]; then
  log "This installer must be run as root."
  exit 1
fi

for cmd in "$PYTHON_BIN" systemctl; do
  require_command "$cmd"
done

log "Ensuring dedicated system account exists"
if ! id -u "$AGENT_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$INSTALL_ROOT" --shell /usr/sbin/nologin "$AGENT_USER"
fi

log "Creating installation directories"
mkdir -p "$INSTALL_ROOT"/logs
chown -R "$AGENT_USER:$AGENT_USER" "$INSTALL_ROOT"
chmod 750 "$INSTALL_ROOT"

log "Creating Python virtual environment"
"$PYTHON_BIN" -m venv "$INSTALL_ROOT/venv"
VENV_PY="$INSTALL_ROOT/venv/bin/python"

log "Upgrading pip and installing runtime dependencies"
"$VENV_PY" -m pip install --upgrade pip wheel
"$VENV_PY" -m pip install \
  "transformers>=4.40" \
  "accelerate>=0.28" \
  "fastapi>=0.111" \
  "uvicorn[standard]>=0.29" \
  "huggingface_hub>=0.23" \
  "safetensors>=0.4" \
  "sentencepiece>=0.1"

log "Authoring Kwaipilot FastAPI service"
cat > "$INSTALL_ROOT/kwaipilot_agent.py" <<'PY'
"""FastAPI wrapper for the Kwaipilot KAT-Dev-72B-Exp model."""
from __future__ import annotations

import os
from typing import Optional

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_NAME = os.environ.get("KWAI_MODEL_NAME", "Kwaipilot/KAT-Dev-72B-Exp")
DEFAULT_MAX_NEW_TOKENS = int(os.environ.get("KWAI_DEFAULT_MAX_NEW_TOKENS", "65536"))
DEFAULT_TEMPERATURE = float(os.environ.get("KWAI_DEFAULT_TEMPERATURE", "0.6"))
HF_TOKEN = os.environ.get("HF_TOKEN")

app = FastAPI(title="Kwaipilot Agent", version="1.0.0")

_tokenizer_kwargs = {"token": HF_TOKEN} if HF_TOKEN else {}
_model_kwargs = {
    "device_map": "auto",
    "torch_dtype": "auto",
}
if HF_TOKEN:
    _model_kwargs["token"] = HF_TOKEN

_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, **_tokenizer_kwargs)
_model = AutoModelForCausalLM.from_pretrained(MODEL_NAME, **_model_kwargs)


class ChatRequest(BaseModel):
    prompt: str
    max_new_tokens: Optional[int] = None
    temperature: Optional[float] = None


class ChatResponse(BaseModel):
    response: str
    tokens_generated: int


def _generate(prompt: str, max_new_tokens: int, temperature: float) -> ChatResponse:
    messages = [{"role": "user", "content": prompt}]
    text = _tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = _tokenizer([text], return_tensors="pt").to(_model.device)

    with torch.no_grad():
        output = _model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0,
            temperature=temperature,
        )

    new_tokens = output[0][inputs.input_ids.shape[1]:]
    completion = _tokenizer.decode(new_tokens, skip_special_tokens=True)
    return ChatResponse(response=completion, tokens_generated=new_tokens.shape[0])


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt must not be empty")

    max_new_tokens = request.max_new_tokens or DEFAULT_MAX_NEW_TOKENS
    if max_new_tokens <= 0:
        raise HTTPException(status_code=400, detail="max_new_tokens must be positive")

    temperature = request.temperature if request.temperature is not None else DEFAULT_TEMPERATURE
    if not (0 <= temperature <= 2):
        raise HTTPException(status_code=400, detail="temperature must be between 0 and 2")

    try:
        return _generate(request.prompt, max_new_tokens, temperature)
    except RuntimeError as exc:  # pragma: no cover - surface inference errors
        raise HTTPException(status_code=500, detail=str(exc)) from exc
PY

chown "$AGENT_USER:$AGENT_USER" "$INSTALL_ROOT/kwaipilot_agent.py"
chmod 640 "$INSTALL_ROOT/kwaipilot_agent.py"

log "Creating environment configuration at $ENV_FILE"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<ENV
# Optional Hugging Face access token with permissions to download Kwaipilot models
HF_TOKEN=
# Override to point at a different Kwaipilot release if desired
KWAI_MODEL_NAME=${MODEL_REPO}
# Default inference parameters used when /chat payload omits overrides
KWAI_DEFAULT_MAX_NEW_TOKENS=65536
KWAI_DEFAULT_TEMPERATURE=0.6
ENV
  chown "$AGENT_USER:$AGENT_USER" "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi

log "Writing systemd unit file"
cat > "$SERVICE_FILE" <<SERVICE
[Unit]
Description=Kwaipilot LLM Agent API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$AGENT_USER
Group=$AGENT_USER
WorkingDirectory=$INSTALL_ROOT
EnvironmentFile=$ENV_FILE
ExecStart=$INSTALL_ROOT/venv/bin/uvicorn kwaipilot_agent:app --host 0.0.0.0 --port 8080
Restart=on-failure
RestartSec=5
StandardOutput=append:$INSTALL_ROOT/logs/service.log
StandardError=append:$INSTALL_ROOT/logs/service.log

[Install]
WantedBy=multi-user.target
SERVICE

log "Reloading systemd daemon"
systemctl daemon-reload

if grep -q '^HF_TOKEN=$' "$ENV_FILE"; then
  log "HF_TOKEN is empty in $ENV_FILE. Populate it before starting the service:"
  log "  sudo systemctl enable --now kwaipilot-agent.service"
else
  log "Enabling and starting kwaipilot-agent.service"
  systemctl enable --now kwaipilot-agent.service
fi

log "Kwaipilot agent installation routine completed"
