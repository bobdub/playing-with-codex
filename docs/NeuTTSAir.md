# NeuTTS Air Overview

NeuTTS Air is Neuphonic's on-device text-to-speech system focused on fast, realistic voice synthesis with instant voice cloning. The following reference condenses the public release notes for quick consultation inside the Imagination Network workspace.

## Key Capabilities

- **High-fidelity speech** – produces natural, humanlike audio compared with similarly sized systems.
- **On-device friendly** – distributed as lightweight GGUF (GGML) builds capable of running on laptops, phones, or small single-board computers.
- **Instant cloning** – recreates a speaker's style from a ~3 second reference sample.
- **Streamlined architecture** – combines a 0.5B parameter LLM backbone with a NeuCodec audio codec for balanced speed and quality.
- **Watermarked output** – all generations embed the Perth perceptual watermark for traceability.

## Model Package

- **Backbone**: Qwen 0.5B adapted for text understanding and conditioning the speech decoder.
- **Audio Codec**: NeuCodec single-codebook neural codec tuned for high quality at low bitrates.
- **Format**: GGML (GGUF) binaries including Q8 and Q4 quantized releases for CPU-friendly inference.
- **Performance**: Real-time generation on mid-range consumer hardware with mobile-ready power usage.

## Getting Started

Clone the official repository and install dependencies:

```bash
git clone https://github.com/neuphonic/neutts-air.git
cd neuttsair

# Install espeak (system requirement)
brew install espeak        # macOS
sudo apt install espeak    # Ubuntu / Debian
paru -S aur/espeak         # Arch Linux

# Python requirements (tested on Python >= 3.11)
pip install -r requirements.txt
```

### Basic Example

```bash
python -m examples.basic_example \
  --input_text "My name is Dave, and um, I'm from London" \
  --ref_audio samples/dave.wav \
  --ref_text samples/dave.txt
```

Specify `--backbone` to target a particular GGUF release from the [NeuTTS Air Hugging Face collection](https://huggingface.co/collections/neuphonic/neutts-air-66fd5f1767f3cafb3589d453).

### Python API Snippet

```python
from neuttsair.neutts import NeuTTSAir
import soundfile as sf

tts = NeuTTSAir(
    backbone_repo="neuphonic/neutts-air-q4-gguf",
    backbone_device="cpu",
    codec_repo="neuphonic/neucodec",
    codec_device="cpu"
)

input_text = "My name is Dave, and um, I'm from London."
ref_text = "samples/dave.txt"
ref_audio_path = "samples/dave.wav"

ref_text = open(ref_text, "r").read().strip()
ref_codes = tts.encode_reference(ref_audio_path)

wav = tts.infer(input_text, ref_codes, ref_text)
sf.write("test.wav", wav, 24000)
```

### Reference Assets

Sample voices are bundled under `examples/samples/` in the upstream repository:

- `samples/dave.wav`
- `samples/jo.wav`

For best results choose mono, 16–44 kHz WAV clips lasting 3–15 seconds with minimal noise and natural speech cadence.

## Safety & Authenticity Notes

- Neuphonic watermarks all generations with the Perth perceptual watermark.
- Official updates and support live on [neuphonic.com](https://neuphonic.com); domains such as `neutts.com` are unaffiliated.
- Respect the creators' request to avoid harmful use.

---

> "State-of-the-art voice AI belongs on-device." – Neuphonic
