#!/usr/bin/env python3
"""Validation harness for the Qwen2.5 Coder FastAPI service.

This script exercises the `/chat` endpoint using prompts that mirror
kin workflows, compares the responses against curated baselines, and
records latency plus throughput metrics. Use it after provisioning,
gateway configuration, or deployment changes to ensure deterministic
behaviour end-to-end.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib import error, parse, request

DEFAULT_TIMEOUT = 120.0


@dataclass
class CaseResult:
    name: str
    passed: bool
    errors: List[str]
    payload: Dict[str, Any]


class ValidationError(RuntimeError):
    """Raised when the service fails validation."""


def build_url(base: str, path: str) -> str:
    """Join base URL and relative path without losing path segments."""
    normalised_base = base.rstrip("/") + "/"
    normalised_path = path.lstrip("/")
    return parse.urljoin(normalised_base, normalised_path)


def load_baseline(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Baseline file not found: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if "cases" not in data or not isinstance(data["cases"], list):
        raise ValueError("Baseline file must contain a 'cases' array")
    return data


def http_request(url: str, *, data: Optional[bytes] = None, timeout: float = DEFAULT_TIMEOUT) -> Dict[str, Any]:
    headers = {"Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = request.Request(url, data=data, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout) as response:
            payload = response.read()
            if not payload:
                return {}
            return json.loads(payload.decode("utf-8"))
    except error.HTTPError as exc:  # pragma: no cover - network-dependent
        try:
            body = exc.read().decode("utf-8")
        except Exception:  # pragma: no cover - best effort decode
            body = exc.reason
        raise ValidationError(f"HTTP {exc.code} for {url}: {body}") from exc
    except error.URLError as exc:  # pragma: no cover - network-dependent
        raise ValidationError(f"Failed to reach {url}: {exc.reason}") from exc


def call_chat(url: str, prompt: str, *, max_new_tokens: int, temperature: float, timeout: float) -> Dict[str, Any]:
    payload = {
        "prompt": prompt,
        "max_new_tokens": max_new_tokens,
        "temperature": temperature,
    }
    encoded = json.dumps(payload).encode("utf-8")
    start = time.perf_counter()
    result = http_request(url, data=encoded, timeout=timeout)
    result["duration_ms"] = (time.perf_counter() - start) * 1000
    result["max_new_tokens"] = max_new_tokens
    result["temperature"] = temperature
    return result


def evaluate_case(case: Dict[str, Any], invocation: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    response_text = str(invocation.get("response", ""))
    trimmed_response = response_text.strip()

    expected_exact = case.get("expect_exact")
    if expected_exact is not None and trimmed_response != expected_exact:
        errors.append(
            "expected exact response does not match baseline",
        )

    expected_contains: Iterable[str] = case.get("expect_contains", [])
    for snippet in expected_contains:
        if snippet not in response_text:
            errors.append(f"missing expected substring: {snippet!r}")

    expected_regex = case.get("expect_regex")
    if expected_regex:
        if not re.search(expected_regex, response_text, flags=re.MULTILINE):
            errors.append(f"response does not match regex: {expected_regex}")

    if case.get("expect_json"):
        try:
            json.loads(response_text)
        except json.JSONDecodeError as exc:
            errors.append(f"response is not valid JSON: {exc}")

    max_tokens = invocation.get("max_new_tokens")
    tokens_generated = invocation.get("tokens_generated")
    if isinstance(max_tokens, int) and isinstance(tokens_generated, int):
        if tokens_generated > max_tokens:
            errors.append(
                f"response generated {tokens_generated} tokens but max_new_tokens is {max_tokens}",
            )

    latency_limit = case.get("max_latency_ms")
    latency_ms = invocation.get("latency_ms")
    if latency_limit is not None and isinstance(latency_ms, (int, float)):
        if latency_ms > latency_limit:
            errors.append(
                f"latency {latency_ms:.2f}ms exceeds limit {latency_limit}ms",
            )

    throughput_floor = case.get("min_tokens_per_second")
    tokens_per_second = invocation.get("tokens_per_second")
    if throughput_floor is not None and isinstance(tokens_per_second, (int, float)):
        if tokens_per_second < throughput_floor:
            errors.append(
                f"tokens/sec {tokens_per_second:.2f} below floor {throughput_floor}",
            )

    return errors


def run_cases(
    *,
    base_url: str,
    chat_path: str,
    health_path: str,
    metrics_path: str,
    baseline: Dict[str, Any],
    timeout: float,
    override_temperature: Optional[float],
    override_max_new_tokens: Optional[int],
) -> Dict[str, Any]:
    health_url = build_url(base_url, health_path)
    chat_url = build_url(base_url, chat_path)
    metrics_url = build_url(base_url, metrics_path)

    health_payload = http_request(health_url, timeout=timeout)

    defaults = baseline.get("defaults", {})
    default_temperature = (
        override_temperature
        if override_temperature is not None
        else defaults.get("temperature", 0.2)
    )
    default_max_tokens = (
        override_max_new_tokens
        if override_max_new_tokens is not None
        else defaults.get("max_new_tokens", 2048)
    )

    results: List[CaseResult] = []
    for raw_case in baseline["cases"]:
        if not isinstance(raw_case, dict):
            raise ValueError("Each case in the baseline must be an object")
        name = raw_case.get("name") or raw_case.get("id")
        if not name:
            raise ValueError("Each case must have a 'name'")

        prompt = raw_case.get("prompt")
        if not prompt:
            raise ValueError(f"Case '{name}' is missing a prompt")

        case_temperature = raw_case.get("temperature", default_temperature)
        case_max_tokens = raw_case.get("max_new_tokens", default_max_tokens)
        if not isinstance(case_max_tokens, int) or case_max_tokens <= 0:
            raise ValueError(f"Case '{name}' has invalid max_new_tokens value")

        invocation = call_chat(
            chat_url,
            prompt,
            max_new_tokens=case_max_tokens,
            temperature=float(case_temperature),
            timeout=timeout,
        )

        invocation.setdefault("latency_ms", invocation.get("duration_ms"))
        errors = evaluate_case(raw_case, invocation)

        results.append(
            CaseResult(
                name=str(name),
                passed=not errors,
                errors=errors,
                payload=invocation,
            )
        )

    metrics_payload = {}
    try:
        metrics_payload = http_request(metrics_url, timeout=timeout)
    except ValidationError:
        metrics_payload = {"warning": "metrics endpoint unavailable"}

    return {
        "health": health_payload,
        "results": results,
        "metrics": metrics_payload,
    }


def render_summary(outcome: Dict[str, Any]) -> None:
    health = outcome.get("health", {})
    print("Service health:")
    if health:
        for key, value in health.items():
            print(f"  {key}: {value}")
    else:
        print("  (no payload)")
    print()

    any_failure = False
    for case in outcome.get("results", []):
        status = "PASS" if case.passed else "FAIL"
        payload = case.payload
        latency = payload.get("latency_ms")
        tokens = payload.get("tokens_generated")
        tps = payload.get("tokens_per_second")
        print(f"[{status}] {case.name}")
        print(
            f"  tokens: {tokens} · latency: {latency:.2f} ms · tokens/sec: {tps:.2f}"
            if isinstance(latency, (int, float)) and isinstance(tps, (int, float))
            else f"  tokens: {tokens}"
        )
        if not case.passed:
            any_failure = True
            for error_message in case.errors:
                print(f"    - {error_message}")
        print()

    if any_failure:
        raise ValidationError("One or more validation cases failed")


def serialise_report(outcome: Dict[str, Any]) -> Dict[str, Any]:
    serialised_results = []
    for case in outcome.get("results", []):
        serialised_results.append(
            {
                "name": case.name,
                "passed": case.passed,
                "errors": case.errors,
                "payload": case.payload,
            }
        )
    return {
        "health": outcome.get("health", {}),
        "metrics": outcome.get("metrics", {}),
        "results": serialised_results,
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8080",
        help="Base URL for the FastAPI service or gateway",
    )
    parser.add_argument(
        "--chat-path",
        default="/chat",
        help="Path to append to the base URL for chat requests",
    )
    parser.add_argument(
        "--health-path",
        default="/health",
        help="Path for the health probe",
    )
    parser.add_argument(
        "--metrics-path",
        default="/metrics",
        help="Path for the metrics endpoint",
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        default=None,
        help="Path to the baseline JSON file",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=None,
        help="Override temperature for every case",
    )
    parser.add_argument(
        "--max-new-tokens",
        type=int,
        default=None,
        help="Override max_new_tokens for every case",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT,
        help="Request timeout in seconds",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Write a JSON report with detailed results",
    )

    args = parser.parse_args(argv)

    script_dir = Path(__file__).resolve().parent
    default_baseline = script_dir.parent / "docs" / "QwenWorkflowValidationBaseline.json"
    baseline_path = args.baseline or default_baseline

    try:
        baseline = load_baseline(baseline_path)
        outcome = run_cases(
            base_url=args.base_url,
            chat_path=args.chat_path,
            health_path=args.health_path,
            metrics_path=args.metrics_path,
            baseline=baseline,
            timeout=args.timeout,
            override_temperature=args.temperature,
            override_max_new_tokens=args.max_new_tokens,
        )
        render_summary(outcome)

        if args.report:
            report_payload = serialise_report(outcome)
            args.report.parent.mkdir(parents=True, exist_ok=True)
            with args.report.open("w", encoding="utf-8") as handle:
                json.dump(report_payload, handle, indent=2, sort_keys=True)
            print(f"Report written to {args.report}")

    except (ValidationError, ValueError, FileNotFoundError) as exc:
        print(f"Validation failed: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
