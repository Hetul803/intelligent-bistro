import { AIOrderResponse, AIOrderResponseSchema } from '../schemas/orderAction.js';
import { menu } from '../data/menu.js';

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6
};

function quantityNear(message: string, keywords: string[], fallback = 1): number {
  const lower = message.toLowerCase();
  for (const keyword of keywords) {
    const index = lower.indexOf(keyword);
    if (index >= 0) {
      const before = lower.slice(Math.max(0, index - 25), index).trim().split(/\s+/).pop() || '';
      if (/^\d+$/.test(before)) return Math.max(1, Number(before));
      if (numberWords[before]) return numberWords[before];
    }
  }
  return fallback;
}

function hasAny(message: string, terms: string[]): boolean {
  return terms.some(term => message.includes(term));
}

export function deterministicParse(message: string): AIOrderResponse {
  const lower = message.toLowerCase();
  const actions: AIOrderResponse['actions'] = [];
  const summaries: string[] = [];

  if (hasAny(lower, ['clear cart', 'clear my cart', 'start over', 'empty cart'])) {
    return AIOrderResponseSchema.parse({
      assistantMessage: 'I cleared your cart so you can start fresh.',
      actions: [{ type: 'CLEAR_CART' }],
      needsClarification: false,
      clarificationQuestion: null,
      suggestedItems: []
    });
  }

  if (hasAny(lower, ['vegetarian', 'veggie options', 'meat free', 'meat-free'])) {
    return AIOrderResponseSchema.parse({
      assistantMessage: 'I found vegetarian-friendly options for you: Veggie Power Bowl, Neon Caesar Salad, Quantum Fries, and Stellar Chocolate Mousse.',
      actions: [{ type: 'SHOW_FILTERED_ITEMS', filter: 'vegetarian' }],
      needsClarification: false,
      clarificationQuestion: null,
      suggestedItems: ['veggie_power_bowl', 'neon_caesar_salad', 'quantum_fries', 'stellar_chocolate_mousse']
    });
  }

  if (lower.includes('burger') && !lower.includes('classic')) {
    return AIOrderResponseSchema.parse({
      assistantMessage: 'I can add a burger, but I want to make sure I choose the right item.',
      actions: [{ type: 'NO_OP' }],
      needsClarification: true,
      clarificationQuestion: 'Do you mean the Classic Bistro Burger?',
      suggestedItems: ['classic_bistro_burger']
    });
  }

  const removing = hasAny(lower, ['remove', 'delete', 'take out', 'take off']);

  const itemRules = [
    { id: 'spicy_chicken_sandwich', terms: ['spicy chicken', 'chicken sandwich', 'spicy sandwich'] },
    { id: 'classic_bistro_burger', terms: ['classic burger', 'bistro burger'] },
    { id: 'veggie_power_bowl', terms: ['veggie bowl', 'power bowl', 'veggie power'] },
    { id: 'neon_caesar_salad', terms: ['caesar', 'salad'] },
    { id: 'quantum_fries', terms: ['fries', 'fry'] },
    { id: 'lunar_lemonade', terms: ['lemonade'] },
    { id: 'large_water', terms: ['water'] },
    { id: 'stellar_chocolate_mousse', terms: ['mousse', 'dessert', 'chocolate'] }
  ];

  for (const rule of itemRules) {
    if (!hasAny(lower, rule.terms)) continue;
    const item = menu.find(m => m.id === rule.id);
    if (!item) continue;
    if (removing) {
      actions.push({ type: 'REMOVE_ITEM', itemId: item.id });
      summaries.push(`removed ${item.name}`);
    } else {
      const modifiers: Record<string, unknown> = {};
      const notes: string[] = [];
      if (lower.includes('large') && item.modifiers.sizes?.includes('large')) modifiers.size = 'large';
      if (lower.includes('small') && item.modifiers.sizes?.includes('small')) modifiers.size = 'small';
      if (lower.includes('no onion') || lower.includes('without onion')) notes.push('no onions');
      if (lower.includes('not spicy') || lower.includes('less spicy')) notes.push('reduce spice');
      if (lower.includes('no sauce') || lower.includes('without sauce')) notes.push('no sauce');
      actions.push({
        type: 'ADD_ITEM',
        itemId: item.id,
        quantity: quantityNear(lower, rule.terms),
        modifiers,
        notes
      });
      const qty = quantityNear(lower, rule.terms);
      summaries.push(`added ${qty} ${item.name}${qty > 1 ? 's' : ''}`);
    }
  }

  if (hasAny(lower, ['make', 'change', 'update']) && lower.includes('large')) {
    if (lower.includes('lemonade')) {
      actions.push({ type: 'UPDATE_MODIFIERS', itemId: 'lunar_lemonade', modifiers: { size: 'large' } });
      summaries.push('made the lemonade large');
    }
    if (lower.includes('water')) {
      actions.push({ type: 'UPDATE_MODIFIERS', itemId: 'large_water', modifiers: { size: 'large' } });
      summaries.push('made the water large');
    }
  }

  if (actions.length === 0) {
    return AIOrderResponseSchema.parse({
      assistantMessage: 'I can help with that. Try asking me to add, remove, modify, or filter menu items.',
      actions: [{ type: 'NO_OP' }],
      needsClarification: false,
      clarificationQuestion: null,
      suggestedItems: []
    });
  }

  return AIOrderResponseSchema.parse({
    assistantMessage: `Done — I ${summaries.join(', ')}.`,
    actions,
    needsClarification: false,
    clarificationQuestion: null,
    suggestedItems: []
  });
}
