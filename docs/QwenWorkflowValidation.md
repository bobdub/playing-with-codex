# Qwen2.5 Coder Workflow Validation Guide

Use this guide after provisioning, gateway configuration, or model
deployment updates to ensure the Qwen2.5 Coder FastAPI service responds
deterministically for kin workflows. The validation harness replays
representative prompts, compares the generated text to curated baselines,
and reports latency plus throughput metrics so you can detect drift before
shipping changes to the portal.

## 1. Prerequisites

* The FastAPI service must be running and reachable either directly
  (`http://127.0.0.1:8080`) or through the gateway (`https://gateway/api/qwen`).
* The [environment provisioner](./QwenEnvironmentProvisioning.md) and
  [installation script](./QwenCoderInstallation.md) should already be
  complete so `/opt/qwen-coder-service` exists with valid credentials.
* Copy `scripts/validate_qwen_workflows.py` and
  `docs/QwenWorkflowValidationBaseline.json` onto the host that can reach
  the service endpoints (bastion, service node, or CI runner).

## 2. Run the validation harness

Execute the Python harness against the FastAPI origin or gateway:

```bash
python3 scripts/validate_qwen_workflows.py \
  --base-url https://gateway.internal/api/qwen \
  --report /tmp/qwen-validation/report.json
```

The script performs the following steps:

1. Calls `/health` to confirm the model reports `status: ok`.
2. Replays each prompt defined in
   `docs/QwenWorkflowValidationBaseline.json` with `temperature=0.2` and a
generous `max_new_tokens` budget.
3. Verifies responses against the stored expectations (exact matches,
   required substrings, optional JSON parsing) and asserts latency plus
   throughput thresholds.
4. Optionally writes a machine-readable report summarising tokens,
   latency, and pass/fail status per case.

Successful runs produce output similar to:

```
Service health:
  status: ok
  model: Qwen/Qwen2.5-Coder-32B-Instruct

[PASS] handshake_exact
  tokens: 3 · latency: 712.45 ms · tokens/sec: 9.12
[PASS] structured_json_status
  tokens: 12 · latency: 845.31 ms · tokens/sec: 14.20
[PASS] workflow_summary
  tokens: 78 · latency: 1280.54 ms · tokens/sec: 61.30
```

Any failure exits with a non-zero status and lists the expectations that
were not met (e.g., missing substring, latency threshold breached). Run
`python3 scripts/validate_qwen_workflows.py --help` for additional
parameters (custom timeouts, overriding `temperature`, changing the
baseline path, etc.).

## 3. Curate and update baselines

`docs/QwenWorkflowValidationBaseline.json` stores the acceptance prompts
and expectations. Adjust it as workflows evolve:

1. Edit the file to add new cases or tune thresholds. Each case can use
   `expect_exact`, `expect_contains`, or `expect_regex` to assert behaviour.
2. Keep prompts deterministic (explicit wording, closed-form answers) so
   runs remain stable at `temperature=0.2`.
3. When responses legitimately change, update the baseline file and
   commit the revision alongside the change that prompted it.

For ad-hoc review, run the harness with `--report` and inspect the
captured payloads to understand how the service behaved before updating
the baseline file.

## 4. Operational checkpoints

Integrate the validation harness into routine workflows:

* **After provisioning:** verify the fresh service responds before
  exposing it through the gateway.
* **After gateway updates:** run the harness against the public path to
  confirm authentication, rate limiting, and routing rules allow the
  scripted prompts.
* **Before and after upgrades:** capture a report prior to deploying new
  weights or dependency versions; rerun afterwards to ensure latency,
  token throughput, and deterministic responses remain aligned with kin
  expectations.
* **CI/CD integration:** add a pipeline job that runs the harness against
  a staging environment and stores the JSON report as an artifact. This
  creates an auditable trail for persona fidelity.

Pair the validation output with the observability metrics exposed at
`/metrics` (see [Qwen Monitoring Guide](./QwenMonitoring.md)) to triage
regressions quickly.
