# Qwen2.5 Coder Observability Guide

The FastAPI wrapper for Qwen2.5 Coder now emits structured telemetry so
operators can correlate persona-heavy prompts with infrastructure health.
Use this guide to wire latency, GPU utilisation, and token throughput
into your existing monitoring estate.

## 1. Structured JSON logs

* Location: `/opt/qwen-coder-service/logs/service.log`
* Format: each line is a JSON object with the following keys:
  * `event`: always `"inference"` for generation calls.
  * `status`: `"success"` or `"error"`.
  * `timestamp`: ISO8601 UTC string.
  * `request_id`: unique identifier for correlation across systems.
  * `latency_ms`, `tokens_generated`, and `tokens_per_second`.
  * `prompt_tokens`, `max_new_tokens`, and `temperature`.
  * `gpu`: snapshot of NVML metrics (when available) or PyTorch memory
    allocations when NVML is missing.
* Ingest strategy: configure your log shipper (e.g. Fluent Bit, Vector,
  or Elastic Agent) to parse JSON per line and forward to your preferred
  analytics stack. Latency and throughput fields can be used to build
  percentile dashboards or anomaly detectors that highlight prompt drift.

## 2. `/metrics` endpoint

* Path: `http://<host>:8080/metrics`
* Payload: JSON object containing aggregated counters and recent sample
  statistics:
  * `requests_total`, `errors_total`
  * `tokens_generated_total`, `prompt_tokens_total`
  * `average_latency_ms`, `p95_latency_ms`
  * `average_tokens_per_second`
  * `last_request_at`
  * `gpu.devices[]` with per-device utilisation and memory data when
    NVML is available
* Scraping: call the endpoint on a cadence (e.g. every 15 seconds) and
  push the response into Prometheus (via the JSON exporter), Influx, or a
  custom collector. The format is designed to be lightweight so that
  network agents and dashboards can be updated without changing the
  service implementation.

## 3. GPU telemetry requirements

* The provisioner installs `pynvml>=11.5` alongside the core
  dependencies. When the host exposes NVIDIA's NVML shared library (via
  the `libnvidia-ml.so` driver), the service records utilisation and
  total/used/free memory per GPU.
* When NVML is unavailable (e.g. in CPU-only tests), the service still
  reports PyTorch-derived allocation and reservation metrics. The `gpu`
  object includes `"nvml_unavailable": true` per device to indicate the
  absence of full telemetry.

## 4. Alerting suggestions

* **Latency:** alert when `p95_latency_ms` doubles relative to the
  baseline established during acceptance testing.
* **Throughput:** monitor `average_tokens_per_second` to detect
  quantisation misconfiguration or degraded batching behaviour.
* **Errors:** wire `errors_total` into your paging policy and trigger if
  it increments more than once within a five-minute window.
* **GPU saturation:** set warnings when `utilization_gpu_percent` stays
  above 90% for ten minutes; the log stream includes per-request
  snapshots for deeper forensics.

Combine these signals with the existing gateway access logs to maintain a
complete view of the Qwen persona endpoints across the Imagination
Network. Pair routine monitoring with the
[`validate_qwen_workflows.py`](../scripts/validate_qwen_workflows.py)
harness so deterministic prompts stay aligned with the baselines stored
in `docs/QwenWorkflowValidationBaseline.json`.
