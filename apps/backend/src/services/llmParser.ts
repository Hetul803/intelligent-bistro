import OpenAI from 'openai';
import { menu } from '../data/menu.js';
import { AIOrderResponseSchema } from '../schemas/orderAction.js';
import { deterministicParse } from './deterministicParser.js';

export async function parseOrderWithAI(message: string, cart: unknown) {
  if (!process.env.OPENAI_API_KEY || process.env.AI_PROVIDER === 'mock') {
    return deterministicParse(message);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are the ordering intelligence for Intelligent Bistro. Convert customer natural language into strict JSON cart actions. Only use itemIds from the provided menu. Return JSON with assistantMessage, actions, needsClarification, clarificationQuestion, suggestedItems. Valid action types: ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY, UPDATE_MODIFIERS, CLEAR_CART, SHOW_CATEGORY, SHOW_FILTERED_ITEMS, NO_OP.`
        },
        {
          role: 'user',
          content: JSON.stringify({ message, cart, menu }, null, 2)
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return AIOrderResponseSchema.parse(parsed);
  } catch (error) {
    console.error('LLM parse failed. Falling back to deterministic parser.', error);
    return deterministicParse(message);
  }
}
