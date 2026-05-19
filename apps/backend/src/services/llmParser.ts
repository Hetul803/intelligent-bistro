import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { menu } from '../data/menu.js';
import { AIOrderResponseSchema } from '../schemas/orderAction.js';
import { deterministicParse } from './deterministicParser.js';

type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export async function parseOrderWithAI(message: string, cart: unknown, conversation: ConversationTurn[] = []) {
  if (process.env.AI_PROVIDER === 'ollama') {
    return parseOrderWithOllama(message, cart, conversation);
  }

  if (process.env.AI_PROVIDER !== 'openai' || !process.env.OPENAI_API_KEY) {
    return deterministicParse(message, cart);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const response = await client.responses.parse({
      model,
      temperature: 0.1,
      max_output_tokens: 1200,
      instructions:
        [
          'You are the AI ordering agent for Intelligent Bistro. Your job is to save the guest time by comparing the menu, narrowing choices, and safely editing the cart.',
          'Return only validated structured output that matches the schema.',
          'Only use itemIds from the provided menu. Never invent menu items.',
          'Respect the current cart. For edits to existing items, prefer UPDATE_QUANTITY, UPDATE_MODIFIERS, REMOVE_ITEM, or a remove+add swap instead of adding duplicates.',
          'Support chat edits like "make that large", "remove it", "double the sandwich", "no sauce", "less spicy", "swap the salad for the bowl", and "add one more". Resolve pronouns from the current cart and recent conversation when possible.',
          'Do not add drinks unless the user explicitly asks for a drink. If a food order feels incomplete, ask a short follow-up and put drink itemIds in suggestedItems.',
          'If constraints conflict, do not fake the answer. Return NO_OP, explain the closest match, and ask one concise clarification question.',
          'assistantMessage should feel like a helpful restaurant agent, not a JSON parser. Keep it brief and demo-friendly.',
          'actionTrace must be a concise operational trace, not hidden chain-of-thought. cartDiff should describe visible cart changes. impact should show why AI saved work, such as menu scan, choices narrowed, cart ops, budget, or drink guardrails.'
        ].join(' '),
      input: JSON.stringify(
        {
          message,
          currentCart: cart,
          recentConversation: conversation.slice(-8),
          menu
        },
        null,
        2
      ),
      text: {
        format: zodTextFormat(AIOrderResponseSchema, 'intelligent_bistro_order')
      }
    });

    const parsed = response.output_parsed;
    if (!parsed) return deterministicParse(message, cart);
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

async function parseOrderWithOllama(message: string, cart: unknown, conversation: ConversationTurn[] = []) {
  const model = process.env.OLLAMA_MODEL || 'llama3.2:1b';
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';

  try {
    const response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.1 },
        messages: [
          {
            role: 'system',
            content:
              'You are the ordering intelligence for Intelligent Bistro. Convert customer language into strict JSON only. Use only itemIds from the provided menu. Supported action types are ADD_ITEM, REMOVE_ITEM, UPDATE_QUANTITY, UPDATE_MODIFIERS, CLEAR_CART, SHOW_CATEGORY, SHOW_FILTERED_ITEMS, NO_OP. If ambiguous, return needsClarification true, one clarificationQuestion, and a NO_OP action. Include assistantMessage, actions, needsClarification, clarificationQuestion, suggestedItems, confidence, normalizedIntent, actionTrace, cartDiff, and impact. No markdown.'
          },
          {
            role: 'user',
            content: JSON.stringify({ message, cart, recentConversation: conversation.slice(-8), menu }, null, 2)
          }
        ]
      })
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const payload = (await response.json()) as { message?: { content?: string } };
    const content = payload.message?.content || '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Ollama response did not contain JSON');
    const parsed = JSON.parse(content.slice(start, end + 1));
    return AIOrderResponseSchema.parse({
      ...parsed,
      provider: 'ollama',
      model
    });
  } catch (error) {
    console.error('Ollama parse failed. Falling back to deterministic parser.', error);
    return deterministicParse(message, cart);
  }
}
