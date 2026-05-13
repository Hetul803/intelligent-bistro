import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { menu } from '../data/menu.js';
import { AIOrderResponseSchema } from '../schemas/orderAction.js';
import { deterministicParse } from './deterministicParser.js';

export async function parseOrderWithAI(message: string, cart: unknown) {
  if (!process.env.OPENAI_API_KEY || process.env.AI_PROVIDER === 'mock') {
    return deterministicParse(message, cart);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const response = await client.responses.parse({
      model,
      temperature: 0.1,
      max_output_tokens: 900,
      instructions:
        'You are the ordering intelligence for Intelligent Bistro. Convert customer language into validated restaurant cart actions. Only use itemIds from the provided menu. Respect the current cart. If a user modifies an existing item, prefer UPDATE_MODIFIERS over adding a duplicate. If the request is ambiguous, ask one concise clarification question and return NO_OP. Return short demo-friendly copy plus a concrete actionTrace and cartDiff. Do not expose hidden chain-of-thought; actionTrace must be a concise operational trace.',
      input: JSON.stringify({ message, cart, menu }, null, 2),
      text: {
        format: zodTextFormat(AIOrderResponseSchema, 'intelligent_bistro_order')
      }
    });

    const parsed = response.output_parsed;
    return AIOrderResponseSchema.parse({
      ...parsed,
      provider: 'openai',
      model
    });
  } catch (error) {
    console.error('LLM parse failed. Falling back to deterministic parser.', error);
    return deterministicParse(message, cart);
  }
}
