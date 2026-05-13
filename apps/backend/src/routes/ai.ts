import { Router } from 'express';
import { z } from 'zod';
import { parseOrderWithAI } from '../services/llmParser.js';

const RequestSchema = z.object({
  message: z.string().min(1),
  cart: z.unknown().optional(),
  menu: z.unknown().optional()
});

export const aiRouter = Router();

aiRouter.post('/order', async (req, res) => {
  const body = RequestSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid request', details: body.error.flatten() });
  }
  const result = await parseOrderWithAI(body.data.message, body.data.cart || []);
  return res.json(result);
});
