"""Utility for sampling microsoft/UserLM-8b for a custom integer sequence prompt."""

from __future__ import annotations

import argparse
from typing import List, Optional

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def resolve_device(preferred: Optional[str] = None) -> torch.device:
    """Return the torch.device to run generation on."""
    if preferred:
        return torch.device(preferred)

    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():  # pragma: no cover - Mac specific
        return torch.device("mps")
    return torch.device("cpu")


def load_models(model_path: str, device: torch.device):
    """Load the tokenizer and model from the Hugging Face Hub."""
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        trust_remote_code=True,
    ).to(device)
    model.eval()
    return tokenizer, model


def build_messages() -> List[dict[str, str]]:
    """Return the chat messages used to instruct the model."""
    return [
        {
            "role": "system",
            "content": (
                "You are a user who wants to implement a special type of sequence. "
                "The sequence sums up the two previous numbers in the sequence and "
                "adds 1 to the result. The first two numbers in the sequence are 1 "
                "and 1."
            ),
        }
    ]


def generate_sequence_response(
    model_path: str = "microsoft/UserLM-8b",
    device: Optional[str] = None,
    max_new_tokens: int = 128,
    top_p: float = 0.8,
    temperature: float = 1.0,
) -> str:
    """Generate a response from the microsoft/UserLM-8b model."""
    resolved_device = resolve_device(device)
    tokenizer, model = load_models(model_path, resolved_device)

    messages = build_messages()
    inputs = tokenizer.apply_chat_template(messages, return_tensors="pt").to(resolved_device)

    end_token = "<|eot_id|>"
    end_token_id = tokenizer.encode(end_token, add_special_tokens=False)

    end_conv_token = "<|endconversation|>"
    end_conv_token_id = tokenizer.encode(end_conv_token, add_special_tokens=False)

    outputs = model.generate(
        input_ids=inputs,
        do_sample=True,
        top_p=top_p,
        temperature=temperature,
        max_new_tokens=max_new_tokens,
        eos_token_id=end_token_id,
        pad_token_id=tokenizer.eos_token_id,
        bad_words_ids=[[token_id] for token_id in end_conv_token_id],
    )
    response = tokenizer.decode(outputs[0][inputs.shape[1]:], skip_special_tokens=True)
    return response.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-path",
        default="microsoft/UserLM-8b",
        help="Model repository to load from the Hugging Face Hub.",
    )
    parser.add_argument(
        "--device",
        help="Optional torch device string (e.g. cuda, cpu, mps). Defaults to auto-detection.",
    )
    parser.add_argument(
        "--max-new-tokens",
        type=int,
        default=128,
        help="Maximum new tokens to sample.",
    )
    parser.add_argument(
        "--top-p",
        type=float,
        default=0.8,
        help="Nucleus sampling probability threshold.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=1.0,
        help="Softmax temperature to control randomness.",
    )
    args = parser.parse_args()

    response = generate_sequence_response(
        model_path=args.model_path,
        device=args.device,
        max_new_tokens=args.max_new_tokens,
        top_p=args.top_p,
        temperature=args.temperature,
    )
    print(response)


if __name__ == "__main__":
    main()
