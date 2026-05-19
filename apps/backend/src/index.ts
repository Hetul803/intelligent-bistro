import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { aiRouter } from './routes/ai.js';
import { menuRouter } from './routes/menu.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  const provider = process.env.AI_PROVIDER || 'local';
  const llmEnabled = provider === 'ollama' || (provider === 'openai' && Boolean(process.env.OPENAI_API_KEY));
  res.json({
    ok: true,
    service: 'intelligent-bistro-backend',
    mode: provider === 'ollama' ? 'ollama-local-llm' : llmEnabled ? 'llm-enabled' : 'offline-local-ai',
    model: provider === 'ollama' ? process.env.OLLAMA_MODEL || 'llama3.2:1b' : llmEnabled ? process.env.OPENAI_MODEL || 'gpt-4.1-mini' : 'local-semantic-order-planner'
  });
});

app.use('/api/menu', menuRouter);
app.use('/api/ai', aiRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(port, () => {
  console.log(`Intelligent Bistro backend running on http://localhost:${port}`);
});
