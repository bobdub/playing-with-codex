#!/usr/bin/env bash
set -euo pipefail

MODEL_REPO="${MODEL_REPO:-Qwen/Qwen2.5-Coder-32B-Instruct}"
AGENT_USER="${AGENT_USER:-qwen}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/qwen-coder-service}"
ENV_FILE="${ENV_FILE:-$INSTALL_ROOT/qwen-coder.env}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/qwen-coder.service}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

export MODEL_REPO AGENT_USER INSTALL_ROOT ENV_FILE PYTHON_BIN

log() {
  echo "[qwen-installer] $*"
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log "Provisioning Python environment and system account"
"$SCRIPT_DIR/provision_qwen_environment.sh"

VENV_PY="$INSTALL_ROOT/venv/bin/python"

log "Authoring Qwen2.5 Coder FastAPI service"
cat > "$INSTALL_ROOT/qwen_service.py" <<'PY'
"""FastAPI wrapper for the Qwen2.5 Coder model with structured observability."""
from __future__ import annotations

import json
import logging
import os
import time
from collections import deque
from datetime import datetime, timezone
from statistics import mean
from threading import Lock
from typing import Any, Deque, Dict, List, Optional, Tuple
from uuid import uuid4

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer

try:  # pragma: no cover - optional dependency
    import pynvml
except Exception:  # pragma: no cover - optional dependency
    pynvml = None  # type: ignore[assignment]

MODEL_NAME = os.environ.get("QWEN_MODEL_NAME", "Qwen/Qwen2.5-Coder-32B-Instruct")
DEFAULT_MAX_NEW_TOKENS = int(os.environ.get("QWEN_DEFAULT_MAX_NEW_TOKENS", "4096"))
DEFAULT_TEMPERATURE = float(os.environ.get("QWEN_DEFAULT_TEMPERATURE", "0.2"))
HF_TOKEN = os.environ.get("HF_TOKEN")

app = FastAPI(title="Qwen2.5 Coder Service", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("qwen_service")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False

_nvml_ready = False
if pynvml is not None:  # pragma: no branch - optional initialisation
    try:
        pynvml.nvmlInit()
        _nvml_ready = True
    except Exception:  # pragma: no cover - NVML init best effort
        _nvml_ready = False

_tokenizer_kwargs = {"token": HF_TOKEN} if HF_TOKEN else {}
_model_kwargs = {
    "device_map": "auto",
    "torch_dtype": "auto",
}
if HF_TOKEN:
    _model_kwargs["token"] = HF_TOKEN

_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, **_tokenizer_kwargs)
_model = AutoModelForCausalLM.from_pretrained(MODEL_NAME, **_model_kwargs)

_metrics_lock = Lock()
_latency_samples: Deque[float] = deque(maxlen=512)
_throughput_samples: Deque[float] = deque(maxlen=512)
_metrics_state = {
    "requests_total": 0,
    "errors_total": 0,
    "tokens_generated_total": 0,
    "prompt_tokens_total": 0,
    "last_request_at": None,
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _isoformat(ts: Optional[datetime]) -> Optional[str]:
    if ts is None:
        return None
    return ts.isoformat().replace("+00:00", "Z")


def _percentile(values: List[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * (percentile / 100)
    f = int(k)
    c = min(f + 1, len(ordered) - 1)
    if f == c:
        return ordered[int(k)]
    d0 = ordered[f] * (c - k)
    d1 = ordered[c] * (k - f)
    return d0 + d1


def _gpu_snapshot() -> Dict[str, Any]:
    if not torch.cuda.is_available():
        return {"gpu_available": False}

    devices: List[Dict[str, Any]] = []
    for index in range(torch.cuda.device_count()):
        info: Dict[str, Any] = {
            "index": index,
            "name": torch.cuda.get_device_name(index),
            "memory_allocated_bytes": int(torch.cuda.memory_allocated(index)),
            "memory_reserved_bytes": int(torch.cuda.memory_reserved(index)),
        }
        if _nvml_ready:
            try:  # pragma: no cover - depends on NVML availability
                handle = pynvml.nvmlDeviceGetHandleByIndex(index)
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                info.update(
                    {
                        "memory_total_bytes": int(mem_info.total),
                        "memory_used_bytes": int(mem_info.used),
                        "memory_free_bytes": int(mem_info.free),
                        "utilization_gpu_percent": int(util.gpu),
                        "utilization_memory_percent": int(util.memory),
                    }
                )
            except Exception:
                info["nvml_unavailable"] = True
        devices.append(info)

    return {
        "gpu_available": True,
        "devices": devices,
    }


def _record_success(latency_ms: float, tokens_generated: int, prompt_tokens: int, tokens_per_second: float) -> None:
    with _metrics_lock:
        _metrics_state["requests_total"] += 1
        _metrics_state["tokens_generated_total"] += tokens_generated
        _metrics_state["prompt_tokens_total"] += prompt_tokens
        _metrics_state["last_request_at"] = _utc_now()
        _latency_samples.append(latency_ms)
        _throughput_samples.append(tokens_per_second)


def _record_failure() -> None:
    with _metrics_lock:
        _metrics_state["requests_total"] += 1
        _metrics_state["errors_total"] += 1
        _metrics_state["last_request_at"] = _utc_now()


def _snapshot_metrics() -> Dict[str, Any]:
    with _metrics_lock:
        latencies = list(_latency_samples)
        throughputs = list(_throughput_samples)
        data = {
            "requests_total": _metrics_state["requests_total"],
            "errors_total": _metrics_state["errors_total"],
            "tokens_generated_total": _metrics_state["tokens_generated_total"],
            "prompt_tokens_total": _metrics_state["prompt_tokens_total"],
            "average_latency_ms": mean(latencies) if latencies else 0.0,
            "p95_latency_ms": _percentile(latencies, 95.0) if latencies else 0.0,
            "average_tokens_per_second": mean(throughputs) if throughputs else 0.0,
            "last_request_at": _isoformat(_metrics_state["last_request_at"]),
            "gpu": _gpu_snapshot(),
        }
    return data


def _emit_log(event: Dict[str, Any]) -> None:
    logger.info(json.dumps(event, sort_keys=True))


class ChatRequest(BaseModel):
    prompt: str
    max_new_tokens: Optional[int] = None
    temperature: Optional[float] = None


class ChatResponse(BaseModel):
    response: str
    tokens_generated: int
    tokens_per_second: float
    latency_ms: float


class MetricsResponse(BaseModel):
    requests_total: int
    errors_total: int
    tokens_generated_total: int
    prompt_tokens_total: int
    average_latency_ms: float
    p95_latency_ms: float
    average_tokens_per_second: float
    last_request_at: Optional[str]
    gpu: Dict[str, Any]


def _generate(prompt: str, max_new_tokens: int, temperature: float) -> Tuple[str, int, int]:
    messages = [{"role": "user", "content": prompt}]
    text = _tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = _tokenizer([text], return_tensors="pt").to(_model.device)
    prompt_tokens = inputs.input_ids.shape[1]

    with torch.no_grad():
        output = _model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=temperature > 0,
            temperature=temperature,
        )

    new_tokens = output[0][prompt_tokens:]
    completion = _tokenizer.decode(new_tokens, skip_special_tokens=True)
    return completion, new_tokens.shape[0], prompt_tokens


@app.get("/health")
def healthcheck() -> Dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.get("/metrics", response_model=MetricsResponse)
def metrics() -> MetricsResponse:
    return MetricsResponse(**_snapshot_metrics())


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

    prompt_tokens = 0
    request_id = str(uuid4())
    if torch.cuda.is_available():
        torch.cuda.synchronize()
    start = time.perf_counter()

    try:
        completion, tokens_generated, prompt_tokens = _generate(
            request.prompt, max_new_tokens, temperature
        )
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        latency_seconds = time.perf_counter() - start
        latency_ms = latency_seconds * 1000
        tokens_per_second = (
            tokens_generated / latency_seconds if latency_seconds > 0 else 0.0
        )
        _record_success(latency_ms, tokens_generated, prompt_tokens, tokens_per_second)
        _emit_log(
            {
                "event": "inference",
                "status": "success",
                "request_id": request_id,
                "timestamp": _isoformat(_utc_now()),
                "model": MODEL_NAME,
                "latency_ms": latency_ms,
                "tokens_generated": tokens_generated,
                "tokens_per_second": tokens_per_second,
                "prompt_tokens": prompt_tokens,
                "max_new_tokens": max_new_tokens,
                "temperature": temperature,
                "gpu": _gpu_snapshot(),
            }
        )
        return ChatResponse(
            response=completion,
            tokens_generated=tokens_generated,
            tokens_per_second=tokens_per_second,
            latency_ms=latency_ms,
        )
    except RuntimeError as exc:  # pragma: no cover - surface inference errors
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        _record_failure()
        _emit_log(
            {
                "event": "inference",
                "status": "error",
                "request_id": request_id,
                "timestamp": _isoformat(_utc_now()),
                "model": MODEL_NAME,
                "error": str(exc),
                "prompt_tokens": prompt_tokens,
                "max_new_tokens": max_new_tokens,
                "temperature": temperature,
                "gpu": _gpu_snapshot(),
            }
        )
        raise HTTPException(status_code=500, detail=str(exc)) from exc
PY

chown "$AGENT_USER:$AGENT_USER" "$INSTALL_ROOT/qwen_service.py"
chmod 640 "$INSTALL_ROOT/qwen_service.py"

log "Priming service log file"
touch "$INSTALL_ROOT/logs/service.log"
chown "$AGENT_USER:$AGENT_USER" "$INSTALL_ROOT/logs/service.log"
chmod 640 "$INSTALL_ROOT/logs/service.log"

log "Writing systemd unit file"
cat > "$SERVICE_FILE" <<SERVICE
[Unit]
Description=Qwen2.5 Coder LLM Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$AGENT_USER
Group=$AGENT_USER
WorkingDirectory=$INSTALL_ROOT
EnvironmentFile=$ENV_FILE
ExecStart=$INSTALL_ROOT/venv/bin/uvicorn qwen_service:app --host 0.0.0.0 --port 8080
Restart=always
RestartSec=5
StandardOutput=append:$INSTALL_ROOT/logs/service.log
StandardError=append:$INSTALL_ROOT/logs/service.log

[Install]
WantedBy=multi-user.target
SERVICE

log "Reloading systemd daemon"
systemctl daemon-reload

if grep -q '^HF_TOKEN=$' "$ENV_FILE"; then
  log "HF_TOKEN is empty in $ENV_FILE; continuing with anonymous Hugging Face access."
fi

log "Enabling and starting qwen-coder.service"
systemctl enable --now qwen-coder.service

log "Service logs available at $INSTALL_ROOT/logs/service.log"
log "Qwen2.5 Coder installation routine completed"
