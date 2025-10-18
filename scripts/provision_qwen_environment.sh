#!/usr/bin/env bash
set -euo pipefail
umask 027

MODEL_REPO="${MODEL_REPO:-Qwen/Qwen2.5-Coder-32B-Instruct}"
AGENT_USER="${AGENT_USER:-qwen}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/qwen-coder-service}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/qwen-coder.env}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
HF_TOKEN_VALUE="${HF_TOKEN:-}"

REQUIRED_PACKAGES=(
  "transformers>=4.40"
  "accelerate>=0.28"
  "fastapi>=0.111"
  "uvicorn[standard]>=0.29"
  "huggingface_hub>=0.23"
  "safetensors>=0.4"
  "sentencepiece>=0.1"
  "pynvml>=11.5"
)

log() {
  echo "[qwen-provision] $*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Missing required command: $1"
    exit 1
  fi
}

if [[ $EUID -ne 0 ]]; then
  log "This provisioner must be run as root."
  exit 1
fi

require_command "$PYTHON_BIN"
require_command mktemp

log "Ensuring dedicated system account exists"
if ! id -u "$AGENT_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$INSTALL_ROOT" --shell /usr/sbin/nologin "$AGENT_USER"
else
  log "System account $AGENT_USER already present"
fi

log "Creating installation directories"
mkdir -p "$INSTALL_ROOT"/logs
chown -R "$AGENT_USER:$AGENT_USER" "$INSTALL_ROOT"
chmod 750 "$INSTALL_ROOT"
chmod 750 "$INSTALL_ROOT/logs"

if [[ ! -d "$INSTALL_ROOT/venv" ]]; then
  log "Creating Python virtual environment"
  "$PYTHON_BIN" -m venv "$INSTALL_ROOT/venv"
else
  log "Virtual environment already exists at $INSTALL_ROOT/venv"
fi

VENV_PY="$INSTALL_ROOT/venv/bin/python"

log "Upgrading pip and wheel inside the virtual environment"
"$VENV_PY" -m pip install --upgrade pip wheel

log "Installing Qwen runtime dependencies"
"$VENV_PY" -m pip install "${REQUIRED_PACKAGES[@]}"

if [[ ! -f "$ENV_FILE" ]]; then
  log "Creating environment configuration at $ENV_FILE"
  cat > "$ENV_FILE" <<ENV
# Optional Hugging Face access token with permissions to download Qwen models
HF_TOKEN=
# Override to point at a different Qwen release if desired
QWEN_MODEL_NAME=${MODEL_REPO}
# Default inference parameters used when /chat payload omits overrides
QWEN_DEFAULT_MAX_NEW_TOKENS=4096
QWEN_DEFAULT_TEMPERATURE=0.2
ENV
else
  log "Environment file already exists at $ENV_FILE"
fi

if [[ -n "$HF_TOKEN_VALUE" ]]; then
  log "Populating Hugging Face token in $ENV_FILE from HF_TOKEN environment variable"
  tmp_env="$(mktemp)"
  awk -v token="$HF_TOKEN_VALUE" '
    /^HF_TOKEN=/ { print "HF_TOKEN=" token; next }
    { print }
  ' "$ENV_FILE" > "$tmp_env"
  mv "$tmp_env" "$ENV_FILE"
else
  log "HF_TOKEN environment variable not provided; leaving placeholder token value"
fi

chown "$AGENT_USER:$AGENT_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

log "Provisioning complete"
