# Qwen2.5 Coder Environment Provisioning Checklist

This runbook prepares an Imagination Network host so the Qwen2.5 Coder FastAPI
service can run in isolation from other workloads. Execute the steps before
bringing the systemd service online.

## 1. Stage the installer assets

1. Copy the repository onto the target host (e.g. `git clone` or `scp`).
2. Ensure the `scripts/provision_qwen_environment.sh` helper is executable:
   ```bash
   chmod +x scripts/provision_qwen_environment.sh
   ```

## 2. Run the environment provisioner (recommended)

Use the automated helper to build the Python environment, install
dependencies, and create the configuration file. Run it as `root` so it can
create the dedicated system account and installation directories under
`/opt/qwen-coder-service`.

> **Security tip:** export `HF_TOKEN` (with the Hugging Face access token) in
> the same shell before running the script. The provisioner copies the value
> directly into the `.env` file without echoing it to stdout and locks the file
> to user-only access.

```bash
sudo ./scripts/provision_qwen_environment.sh
```

The script performs the following actions:

* ensures the `qwen` system account exists and owns `/opt/qwen-coder-service`;
* creates a Python virtual environment at `/opt/qwen-coder-service/venv`;
* installs the `transformers`, `accelerate`, `fastapi`, `uvicorn`,
  `huggingface_hub`, `safetensors`, `sentencepiece`, and `pynvml`
  dependencies (the last one enables GPU utilisation telemetry when NVIDIA's
  NVML library is present); and
* writes `/opt/qwen-coder-service/qwen-coder.env` with the provided Hugging
  Face token (when `HF_TOKEN` is set) plus default inference parameters, then
  sets permissions to `600` so only the `qwen` account can read the file;
* hardens ownership on `/opt/qwen-coder-service` and its `logs/` directory to
  prevent world-readable access.

Override defaults by exporting `MODEL_REPO`, `INSTALL_ROOT`, or `PYTHON_BIN`
before invoking the script.

## 3. Manual provisioning (if automation is unavailable)

When the helper cannot be used, reproduce the steps manually:

1. Create the system account and directories:
   ```bash
   sudo useradd --system --home-dir /opt/qwen-coder-service \
     --shell /usr/sbin/nologin qwen
   sudo mkdir -p /opt/qwen-coder-service/logs
   sudo chown -R qwen:qwen /opt/qwen-coder-service
   sudo chmod 750 /opt/qwen-coder-service
   sudo chmod 750 /opt/qwen-coder-service/logs
   ```
2. Build the Python virtual environment and install packages:
   ```bash
   sudo python3 -m venv /opt/qwen-coder-service/venv
   sudo /opt/qwen-coder-service/venv/bin/python -m pip install --upgrade pip wheel
   sudo /opt/qwen-coder-service/venv/bin/python -m pip install \
     "transformers>=4.40" \
     "accelerate>=0.28" \
     "fastapi>=0.111" \
     "uvicorn[standard]>=0.29" \
     "huggingface_hub>=0.23" \
    "safetensors>=0.4" \
    "sentencepiece>=0.1" \
    "pynvml>=11.5"
   ```
3. Create the environment configuration file and lock down permissions:
   ```bash
   cat <<'ENV' | sudo tee /opt/qwen-coder-service/qwen-coder.env
   HF_TOKEN=
   QWEN_MODEL_NAME=Qwen/Qwen2.5-Coder-32B-Instruct
   QWEN_DEFAULT_MAX_NEW_TOKENS=4096
   QWEN_DEFAULT_TEMPERATURE=0.2
   ENV
   sudo chown qwen:qwen /opt/qwen-coder-service/qwen-coder.env
   sudo chmod 600 /opt/qwen-coder-service/qwen-coder.env
   ```

After either path completes, populate the `HF_TOKEN` value (if required) with
`sudoedit /opt/qwen-coder-service/qwen-coder.env`, copy
`scripts/validate_qwen_workflows.py` plus
`docs/QwenWorkflowValidationBaseline.json` into place, and continue to the
[installation guide](./QwenCoderInstallation.md).
