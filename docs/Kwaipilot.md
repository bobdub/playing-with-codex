
huggingface.co
Kwaipilot/KAT-Dev-72B-Exp · Hugging Face
3 minutes

Kwaipilot
News

🔥 We’re thrilled to announce the release of KAT-Dev-72B-Exp, our latest and most powerful model yet!

🔥 You can now try our strongest proprietary coder model KAT-Coder directly on the StreamLake platform for free.
Highlights

KAT-Dev-72B-Exp is an open-source 72B-parameter model for software engineering tasks.

On SWE-Bench Verified, KAT-Dev-72B-Exp achieves 74.6% accuracy ⚡ — when evaluated strictly with the SWE-agent scaffold.

KAT-Dev-72B-Exp is the experimental reinforcement-learning version of the KAT-Coder model. Through this open-source release, we aim to reveal the technical innovations behind KAT-Coder’s large-scale RL to developers and researchers.

Kim 2025-10-10 165138
Introduction

We rewrote the attention kernel and redesigned the training engine for shared prefix trajectories to achieve highly efficient RL training, especially for scaffolds leveraging context management.

Furthermore, to prevent exploration collapse observed in RL training, we reshaped advantage distribution based on pass rates: amplifying the advantage scale of highly exploratory groups while reducing that of low-exploration ones.
Quickstart

from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "KAT-Dev-72B-Exp"

# load the tokenizer and the model
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto"
)

# prepare the model input
prompt = "Give me a short introduction to large language model."
messages = [
    {"role": "user", "content": prompt}
]
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
)
model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

# conduct text completion
generated_ids = model.generate(
    **model_inputs,
    max_new_tokens=65536
)
output_ids = generated_ids[0][len(model_inputs.input_ids[0]):].tolist() 

content = tokenizer.decode(output_ids, skip_special_tokens=True)

print("content:", content)

SWE agent Evaluation Parameters

temperature: 0.6
max_turns: 150
history_processors.n: 100

For full settings please refer to inference.yaml

Stable open-weight alternatives
--------------------------------
KAT-Dev-72B-Exp remains an experimental RL variant. When you need steadier, production-friendly models with open weights and broad tooling support, the community currently gravitates toward the following options:

* **Qwen2.5-Coder-32B-Instruct** – drop-in coder with strong tool use, 128K-token context, and first-class support across Hugging Face, vLLM, and Ollama.
* **DeepSeek-Coder-V2-Instruct (MoE)** – excels at blended code + reasoning workloads; mind the mixture-of-experts memory footprint when quantizing.
* **Llama-3.1-70B-Instruct** – balanced generalist with reliable coding skills, widely quantized by third-party runtimes.
* **StarCoder2-15B-Instruct** – lightweight, mature ecosystem that deploys comfortably on single high-end GPUs while retaining predictable coding behavior.

Practical guidance
------------------
* **Local single-GPU / dual-GPU dev boxes:** Begin with StarCoder2-15B-Instruct; step up to Qwen2.5-Coder-32B-Instruct if you can spare ~48–64 GB of VRAM or run a 4-bit GGUF/EXL2 quantization.
* **On-prem servers with ample VRAM:** Lead with Qwen2.5-Coder-32B-Instruct, then experiment with DeepSeek-Coder-V2-Instruct for broader reasoning coverage.
* **API fallback:** Closed platforms such as Claude 4 Sonnet still dominate the SWE-bench Verified leaderboards. Opt into an API when you need maximum stability and are comfortable with non-open weights.

Evaluation reminders
--------------------
SWE-bench outcomes depend heavily on the agent scaffold (SWE-agent, OpenHands, etc.). Reuse the same scaffold when you compare KAT-Dev-72B-Exp against the models above to keep your assessments apples-to-apples. Treat KAT-Dev-72B-Exp’s 74.6% SWE-bench Verified claim as promising yet provisional until it surfaces on the community-maintained boards.

Quick HF Transformers starter (alternatives)
--------------------------------------------
```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = "Qwen/Qwen2.5-Coder-32B-Instruct"  # swap for meta-llama/Llama-3.1-70B-Instruct, deepseek-ai/DeepSeek-Coder-V2-Instruct, etc.
tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(
    model_id,
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

For 100K-token contexts stick with Qwen2.5-Coder-32B-Instruct; Llama-3.1 and StarCoder2 expose shorter effective windows.
