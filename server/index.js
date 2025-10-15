import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const apiKey = process.env.HUGGING_FACE_API_KEY;
const defaultModel = process.env.HUGGING_FACE_MODEL || 'gpt2';

app.post('/api/generate', async (req, res) => {
  if (!apiKey) {
    return res.status(500).send('Missing HUGGING_FACE_API_KEY environment variable.');
  }

  const { prompt } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).send('Prompt is required.');
  }

  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${defaultModel}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.7,
          return_full_text: false
        }
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Hugging Face inference failed');
    }

    const data = await response.json();
    const output = Array.isArray(data)
      ? data.map((item) => item.generated_text).join('\n')
      : data?.generated_text ?? '';

    res.json({
      output,
      model: defaultModel
    });
  } catch (error) {
    console.error('Generation failed', error);
    res.status(500).send('Failed to generate text from Hugging Face.');
  }
});

app.listen(port, () => {
  console.log(`Imagination Network server listening on http://localhost:${port}`);
});
