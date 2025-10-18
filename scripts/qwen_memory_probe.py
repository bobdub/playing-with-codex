#!/usr/bin/env python3
"""Utility to audit GPU memory headroom for Qwen deployments.

This script can optionally load a model checkpoint to measure the real
allocation footprint before production rollout. Run with ``--load-model``
to perform the dry-run load or without it to capture a static snapshot of
available GPU memory.
"""

from __future__ import annotations

import argparse
import sys
from typing import Dict, Tuple

try:
    import torch
except ModuleNotFoundError as exc:  # pragma: no cover - import guard
    print("torch is required to run this probe:", exc, file=sys.stderr)
    sys.exit(2)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model",
        default="Qwen/Qwen2.5-Coder-32B-Instruct",
        help="Hugging Face model identifier to probe.",
    )
    parser.add_argument(
        "--dtype",
        default="bfloat16",
        choices=["float32", "float16", "bfloat16", "int8", "int4"],
        help="Target torch dtype when loading the model (if --load-model is used).",
    )
    parser.add_argument(
        "--min-free-gb",
        type=float,
        default=10.0,
        help="Minimum free memory per GPU (in GB) required after loading.",
    )
    parser.add_argument(
        "--load-model",
        action="store_true",
        help="When set, attempt to load the model to measure true allocation footprint.",
    )
    parser.add_argument(
        "--device-map",
        default="auto",
        help="Device map strategy passed to transformers when loading the model.",
    )
    return parser.parse_args()


def dtype_from_string(dtype_name: str) -> torch.dtype:
    mapping: Dict[str, torch.dtype] = {
        "float32": torch.float32,
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "int8": torch.int8,
        "int4": torch.int8,  # torch lacks int4 tensor dtype; map to int8 for load hint
    }
    return mapping[dtype_name]


def snapshot_memory() -> Dict[int, Tuple[int, int, int]]:
    torch.cuda.synchronize()
    stats: Dict[int, Tuple[int, int, int]] = {}
    for device_idx in range(torch.cuda.device_count()):
        with torch.cuda.device(device_idx):
            total = torch.cuda.get_device_properties(device_idx).total_memory
            reserved = torch.cuda.memory_reserved(device_idx)
            allocated = torch.cuda.memory_allocated(device_idx)
        stats[device_idx] = (total, reserved, allocated)
    return stats


def gb(value_bytes: int) -> float:
    return value_bytes / (1024**3)


def main() -> int:
    if not torch.cuda.is_available():
        print("CUDA is not available; cannot probe GPU memory.", file=sys.stderr)
        return 2

    args = parse_args()

    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()

    pre_stats = snapshot_memory()

    model = None
    if args.load_model:
        try:
            from transformers import AutoModelForCausalLM
        except ModuleNotFoundError as exc:  # pragma: no cover - import guard
            print(
                "transformers is required to load the model: {0}".format(exc),
                file=sys.stderr,
            )
            return 2

        dtype = dtype_from_string(args.dtype)
        print(f"Loading {args.model} with dtype={dtype} and device_map={args.device_map}...")
        model = AutoModelForCausalLM.from_pretrained(
            args.model,
            torch_dtype=dtype,
            device_map=args.device_map,
            trust_remote_code=True,
        )
        torch.cuda.synchronize()

    post_stats = snapshot_memory()

    print("GPU Memory Report (GB):")
    print("device | total | reserved | allocated | free | peak")
    ok = True
    for device_idx in range(torch.cuda.device_count()):
        total, reserved, allocated = post_stats[device_idx]
        peak = torch.cuda.max_memory_allocated(device_idx)
        free = total - reserved
        free_gb = gb(free)
        print(
            f"{device_idx:^6} | {gb(total):>5.1f} | {gb(reserved):>8.1f} | {gb(allocated):>9.1f} | {free_gb:>4.1f} | {gb(peak):>4.1f}"
        )
        if free_gb < args.min_free_gb:
            ok = False

    if model is not None:
        del model
        torch.cuda.empty_cache()

    if not ok:
        print(
            f"Minimum free memory threshold of {args.min_free_gb} GB not met on one or more devices.",
            file=sys.stderr,
        )
        return 1

    print("Memory threshold satisfied across all GPUs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
