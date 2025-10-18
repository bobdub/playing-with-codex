# Qwen Hosting Decision and Integration Plan

## Hosting Decision
We will host **Qwen/Qwen2.5-Coder-32B-Instruct** using the **vLLM** runtime exposed through our existing FastAPI wrapper. This pairing keeps persona-prefixed prompts responsive while preserving the Python service surface that our gateway and kin clients already trust.

* **Persona fidelity:** vLLM consumes Hugging Face chat templates directly, so the "I am..." system prompt that anchors the hero persona renders identically to our Transformers prototype.
* **Throughput and batching:** Continuous batching and paged attention let us serve simultaneous caretakers without queue backlogs. Expect ~2× token throughput over the baseline Transformers loop on the same A100 pair.
* **Operational fit:** The FastAPI contract (`/health`, `/chat`) and systemd unit from `install_qwen_coder_service.sh` remain unchanged—only the backend engine swaps to vLLM, minimising downstream changes.

## Quantisation and Capacity Strategy
* **Primary footprint:** Load the 32B checkpoint with vLLM tensor parallelism across two 80 GB GPUs, sustaining full precision for deterministic coding replies.
* **Memory-constrained mode:** Provide an optional 4-bit AWQ quantised weight set for single 48 GB GPU nodes by toggling `QWEN_MODEL_VARIANT=awq-4bit` in the service environment.
* **Autoscaling hooks:** Document GPU utilisation via Prometheus exporters so caretakers can decide when to add nodes or drop to the quantised tier during peak persona workshops.

## Hardware Footprint Preparation Checklist
Before promoting the migration to production, walk through the following sizing steps with kin:

1. **Profile available GPUs.** Record model, VRAM, and interconnect topology with `nvidia-smi -L` and `nvidia-smi topo -m` so tensor parallel groups map cleanly across NVLink pairs.
2. **Validate memory headroom.** Use the `scripts/qwen_memory_probe.py --load-model --dtype bfloat16` utility run to confirm ≥10 GB free VRAM per device after weights, KV cache, and CUDA context allocation.
3. **Decide on quantisation tier.**
   * Clusters with dual 80 GB GPUs stay on the full-precision path for highest persona fidelity.
   * Constrained single-GPU nodes enable the 4-bit AWQ variant, pairing it with `--max-num-seqs 16` and setting `VLLM_CPU_OFFLOAD_GB=64` for swap breathing room.
4. **Plan offloading and cache.** When the 4-bit tier is enabled, pin the paged attention cache to GPU while routing weights through CPU offload; on larger clusters, keep all weights resident and size `VLLM_GPU_MEMORY_UTILIZATION=0.92` to prevent OOMs during surges.
5. **Document the footprint.** Capture the chosen configuration, including GPU counts, quantisation flag, and offload thresholds, in `project-plan/phase2-evaluation.md` so future caretakers can rerun the sizing audit.

## Implementation Steps
1. **Prepare hosts:** Validate CUDA 12.1, install the vLLM runtime wheels, and extend the service virtual environment with `vllm`, `flash-attn`, and matching `torch`/`triton` builds.
2. **Update service code:** Replace the Transformers `AutoModelForCausalLM` loader with a vLLM `LLM` instance while keeping tokenizer handling intact for persona templates.
3. **Revise configuration:** Add `QWEN_BACKEND=vllm`, `VLLM_TENSOR_PARALLEL_SIZE=2`, and `VLLM_MAX_MODEL_LEN=131072` to `/opt/qwen-coder-service/qwen-coder.env` so deployments default to high-context persona sessions.
4. **Wire batching controls:** Surface `max_batch_tokens` and `swap_space` settings in the `.env` file, documenting recommended values (e.g., `max_batch_tokens=8192`) for kin-specific workloads.
5. **Systemd adjustments:** Ensure the unit starts the FastAPI app with `--worker-class uvicorn.workers.UvicornWorker` and sets `VLLM_CACHE_DIR` to `/opt/qwen-coder-service/cache` for predictable disk usage.
6. **Gateway alignment:** Re-run `scripts/configure_qwen_gateway.sh` (see [Qwen Gateway Bridge Guide](./QwenGatewayBridge.md)) so `/api/qwen` forwards to the refreshed FastAPI port (`8080`) and document the active overrides for downstream clients.
7. **Security posture:** Reapply firewall rules, rotate the Hugging Face token if stored, and enforce mTLS between the gateway and service node according to the Aurora blueprint.
8. **Observability:** Enable vLLM's Prometheus endpoint on `:9090/metrics`, scrape it into the Imagination Network Grafana stack, and alert when `vllm_gpu_cache_usage` exceeds 85%.
9. **Fallback readiness:** Keep the existing Transformers-based unit as a cold standby (`qwen-coder-transformers.service`) that can be enabled if vLLM encounters a regression.

## Validation Checklist
* Run the workflow harness (`python3 scripts/validate_qwen_workflows.py`) to confirm persona preambles and deterministic prompts succeed within the expected latency envelope.
* Capture throughput benchmarks (requests/sec and tokens/sec) before and after the vLLM migration, storing results in `docs/benchmark/qwen_vllm_vs_transformers.md`.
* Review observability dashboards with the kin stakeholders to verify they can trace persona performance and trigger fallbacks when necessary.
