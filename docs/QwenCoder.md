Qwen/Qwen2.5-Coder-32B-Instruct · Hugging Face
==============================================

Qwen2.5 Coder
-------------

🔥 Qwen2.5 Coder 32B Instruct is a state-of-the-art open-weight coding model tuned for software engineering workloads, conversational planning, and tool-augmented reasoning.

Highlights
----------

* 32B parameters with competitive SWE-Bench results while maintaining manageable VRAM requirements compared to 70B+ models.
* 128K-token context window supporting long-form repositories, scaffolds, and agent dialogues.
* First-class support across Hugging Face Transformers, vLLM, and Ollama runtimes with actively maintained quantisations.

Quickstart
----------

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-Coder-32B-Instruct")
model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    device_map="auto",
    torch_dtype="auto",
)

prompt = "Write a well-documented Python CLI that tails a log and highlights ERROR lines."
messages = [{"role": "user", "content": prompt}]
chat = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
inputs = tokenizer([chat], return_tensors="pt").to(model.device)
outputs = model.generate(**inputs, max_new_tokens=1024, temperature=0.2)
print(tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True))
```

Stable open-weight peers
------------------------

* **DeepSeek-Coder-V2-Instruct (MoE)** – excels at blended code + reasoning workloads; mind the mixture-of-experts memory footprint when quantizing.
* **Llama-3.1-70B-Instruct** – balanced generalist with reliable coding skills, widely quantized by third-party runtimes.
* **StarCoder2-15B-Instruct** – lightweight, mature ecosystem that deploys comfortably on single high-end GPUs while retaining predictable coding behaviour.

Deployment tips
---------------

* For local single-GPU or dual-GPU setups, run Qwen2.5-Coder-32B-Instruct in 4-bit (EXL2/GGUF) form or offload layers to CPU when VRAM is constrained.
* For on-prem clusters with ample VRAM, pair Qwen with vLLM to expose high-throughput endpoints to the Imagination Network gateway.
* For API fallbacks, keep a smaller quantisation or closed-weight provider on standby and leverage the gateway auto-discovery logic added to the hero prompt bridge.

Evaluation reminders
--------------------

SWE-Bench outcomes depend heavily on the agent scaffold (SWE-agent, OpenHands, etc.). Reuse the same scaffold when comparing Qwen2.5 Coder against the models above to maintain apples-to-apples benchmarks. Tune decoding parameters per workload—temperature 0.2 and 4K `max_new_tokens` work well for deterministic coding replies inside the Imagination Network portal.
