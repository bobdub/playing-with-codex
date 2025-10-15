"""Example conversation with microsoft/UserLM-8b.

This script mirrors the in-repo Imagination Network prompts but runs
locally using the Hugging Face ``transformers`` library. It recreates an
instruction where the assistant must reason about a modified Fibonacci
sequence that adds one to the sum of the previous two terms.
"""

from __future__ import annotations

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_PATH = "microsoft/UserLM-8b"
SYSTEM_PROMPT = (
    "You are a user who wants to implement a special type of sequence. "
    "The sequence sums up the two previous numbers in the sequence and "
    "adds 1 to the result. The first two numbers in the sequence are 1 "
    "and 1."
)


def load_model(device: str | None = None):
    """Load the tokenizer and model with a sensible device default."""

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)

    if device == "cuda":
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_PATH,
            trust_remote_code=True,
            torch_dtype=torch.float16,
            device_map="auto",
        )
    else:
        model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, trust_remote_code=True)
        model = model.to("cpu")

    return tokenizer, model, device


def generate_response(tokenizer, model, device: str, max_new_tokens: int = 10) -> str:
    """Generate a chat completion for the configured system message."""

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    inputs = tokenizer.apply_chat_template(messages, return_tensors="pt")
    inputs = inputs.to(device)

    end_token = "<|eot_id|>"
    end_token_ids = tokenizer.encode(end_token, add_special_tokens=False)
    eos_token_id = end_token_ids[0] if end_token_ids else tokenizer.eos_token_id

    end_conv_token = "<|endconversation|>"
    end_conv_ids = tokenizer.encode(end_conv_token, add_special_tokens=False)
    bad_words_ids = [[token_id] for token_id in end_conv_ids] if end_conv_ids else None

    generation_kwargs = {
        "input_ids": inputs,
        "do_sample": True,
        "top_p": 0.8,
        "temperature": 1.0,
        "max_new_tokens": max_new_tokens,
        "eos_token_id": eos_token_id,
        "pad_token_id": tokenizer.eos_token_id,
    }

    if bad_words_ids:
        generation_kwargs["bad_words_ids"] = bad_words_ids

    with torch.no_grad():
        outputs = model.generate(**generation_kwargs)

    response = tokenizer.decode(outputs[0][inputs.shape[1] :], skip_special_tokens=True)
    return response.strip()


def main() -> None:
    tokenizer, model, device = load_model()
    print(f"Loaded {MODEL_PATH} on {device}.")
    response = generate_response(tokenizer, model, device)
    print("Model response:\n")
    print(response)


if __name__ == "__main__":
    main()
