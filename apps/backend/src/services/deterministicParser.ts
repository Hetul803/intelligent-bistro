import { AIOrderResponse, AIOrderResponseSchema, CartItemSchema } from '../schemas/orderAction.js';
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

function normalizeCart(cart: unknown) {
  const parsed = CartItemSchema.array().safeParse(cart);
  return parsed.success ? parsed.data : [];
}

function itemName(itemId: string) {
  return menu.find(item => item.id === itemId)?.name || itemId;
}

function pluralize(name: string, quantity: number) {
  if (quantity === 1) return name;
  if (name.endsWith('s')) return name;
  if (name.endsWith('Sandwich')) return `${name}es`;
  return `${name}s`;
}

function describeAction(action: AIOrderResponse['actions'][number]) {
  const name = action.itemId ? itemName(action.itemId) : 'cart';
  if (action.type === 'ADD_ITEM') return `Add ${action.quantity || 1} ${pluralize(name, action.quantity || 1)}`;
  if (action.type === 'REMOVE_ITEM') return `Remove ${name}`;
  if (action.type === 'UPDATE_QUANTITY') return `Set ${name} quantity to ${action.quantity}`;
  if (action.type === 'UPDATE_MODIFIERS') {
    const modifiers = Object.entries(action.modifiers || {}).map(([key, value]) => `${key}: ${String(value)}`);
    const notes = action.notes || [];
    return `Modify ${name}${modifiers.length || notes.length ? ` (${[...modifiers, ...notes].join(', ')})` : ''}`;
  }
  if (action.type === 'CLEAR_CART') return 'Clear the cart';
  if (action.type === 'SHOW_CATEGORY') return `Show ${action.category} items`;
  if (action.type === 'SHOW_FILTERED_ITEMS') return `Filter menu by ${action.filter}`;
  return 'No cart change';
}

function buildResponse(input: {
  assistantMessage: string;
  actions: AIOrderResponse['actions'];
  needsClarification?: boolean;
  clarificationQuestion?: string | null;
  suggestedItems?: string[];
  confidence?: number;
  normalizedIntent?: string;
  actionTrace?: AIOrderResponse['actionTrace'];
  cartDiff?: string[];
}): AIOrderResponse {
  const cartDiff = input.cartDiff || input.actions.filter(action => action.type !== 'NO_OP').map(describeAction);
  return AIOrderResponseSchema.parse({
    needsClarification: false,
    clarificationQuestion: null,
    suggestedItems: [],
    provider: 'deterministic',
    model: 'deterministic-demo-parser',
    confidence: input.confidence ?? 0.88,
    normalizedIntent: input.normalizedIntent || input.assistantMessage,
    actionTrace:
      input.actionTrace ||
      [
        { step: 'Parse', detail: 'Matched the user request against menu items, dietary filters, quantities, and modifier language.' },
        { step: 'Validate', detail: 'Checked every action against the known menu ids and supported cart operations.' },
        { step: 'Apply', detail: cartDiff.length ? cartDiff.join('; ') : 'No mutation needed; the assistant returned a safe no-op.' }
      ],
    cartDiff,
    ...input
  });
}

export function deterministicParse(message: string, cart: unknown = []): AIOrderResponse {
  const lower = message.toLowerCase();
  const currentCart = normalizeCart(cart);
  const actions: AIOrderResponse['actions'] = [];
  const summaries: string[] = [];

  if (hasAny(lower, ['clear cart', 'clear my cart', 'start over', 'empty cart'])) {
    return buildResponse({
      assistantMessage: 'I cleared your cart so you can start fresh.',
      actions: [{ type: 'CLEAR_CART' }],
      normalizedIntent: 'Reset the active cart'
    });
  }

  if (hasAny(lower, ['show drinks', 'drink options', 'show beverages'])) {
    return buildResponse({
      assistantMessage: 'I pulled up the drinks so you can choose a refresh.',
      actions: [{ type: 'SHOW_CATEGORY', category: 'Drinks' }],
      suggestedItems: ['lunar_lemonade', 'large_water'],
      normalizedIntent: 'Filter menu to drinks'
    });
  }

  if (hasAny(lower, ['show desserts', 'dessert options', 'something sweet'])) {
    return buildResponse({
      assistantMessage: 'I found the dessert lane for you.',
      actions: [{ type: 'SHOW_CATEGORY', category: 'Desserts' }],
      suggestedItems: ['stellar_chocolate_mousse'],
      normalizedIntent: 'Filter menu to desserts'
    });
  }

  if (hasAny(lower, ['popular', 'best seller', 'best-seller', 'signature'])) {
    return buildResponse({
      assistantMessage: 'I highlighted the most ordered picks.',
      actions: [{ type: 'SHOW_FILTERED_ITEMS', filter: 'popular' }],
      suggestedItems: ['spicy_chicken_sandwich'],
      normalizedIntent: 'Show popular menu recommendations'
    });
  }

  if (hasAny(lower, ['viral combo', 'combo for two', 'for two', 'two people'])) {
    return buildResponse({
      assistantMessage: 'Built the two-person bistro combo: spicy chicken sandwiches, shared fries, and lemonades.',
      actions: [
        { type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 2 },
        { type: 'ADD_ITEM', itemId: 'quantum_fries', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'lunar_lemonade', quantity: 2, modifiers: { size: 'large' } }
      ],
      suggestedItems: ['stellar_chocolate_mousse'],
      confidence: 0.94,
      normalizedIntent: 'Build a complete two-person combo order'
    });
  }

  if (hasAny(lower, ['surprise me', 'chef pick', "chef's pick", 'best order', 'i trust you'])) {
    return buildResponse({
      assistantMessage: 'I built a chef-picked order with a signature sandwich, fries, and a bright drink.',
      actions: [
        { type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'quantum_fries', quantity: 1, modifiers: { size: 'regular' } },
        { type: 'ADD_ITEM', itemId: 'lunar_lemonade', quantity: 1 }
      ],
      suggestedItems: ['stellar_chocolate_mousse'],
      confidence: 0.9,
      normalizedIntent: 'Create a balanced chef-recommended order'
    });
  }

  if (hasAny(lower, ['high protein', 'protein lunch', 'post workout', 'post-workout'])) {
    return buildResponse({
      assistantMessage: 'Built a high-protein lunch that stays under $25 before tax.',
      actions: [
        { type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'large_water', quantity: 1, modifiers: { size: 'large' } }
      ],
      suggestedItems: ['neon_caesar_salad', 'lunar_lemonade'],
      normalizedIntent: 'Build a high-protein lunch under budget'
    });
  }

  if (hasAny(lower, ['under $20', 'under 20', 'budget', 'cheap lunch'])) {
    return buildResponse({
      assistantMessage: 'Built a clean under-$20 order with a salad and chilled water.',
      actions: [
        { type: 'ADD_ITEM', itemId: 'neon_caesar_salad', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'large_water', quantity: 1 }
      ],
      suggestedItems: ['quantum_fries'],
      normalizedIntent: 'Build a budget-friendly order'
    });
  }

  if (hasAny(lower, ['vegetarian and refreshing', 'plant mode', 'plant based lunch', 'plant-based lunch'])) {
    return buildResponse({
      assistantMessage: 'Built a vegetarian order with a bright drink pairing.',
      actions: [
        { type: 'ADD_ITEM', itemId: 'veggie_power_bowl', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'lunar_lemonade', quantity: 1, modifiers: { size: 'large' } }
      ],
      suggestedItems: ['stellar_chocolate_mousse', 'quantum_fries'],
      normalizedIntent: 'Build a vegetarian order with a refreshing drink'
    });
  }

  if (hasAny(lower, ['gluten free', 'gluten-free'])) {
    return buildResponse({
      assistantMessage: 'I filtered to the safest gluten-free-friendly option on this menu.',
      actions: [{ type: 'SHOW_FILTERED_ITEMS', filter: 'gluten-free' }],
      suggestedItems: ['veggie_power_bowl'],
      normalizedIntent: 'Filter menu for gluten-free-friendly items'
    });
  }

  if (hasAny(lower, ['vegetarian', 'veggie options', 'meat free', 'meat-free'])) {
    return buildResponse({
      assistantMessage: 'I found vegetarian-friendly options for you: Veggie Power Bowl, Neon Caesar Salad, Quantum Fries, and Stellar Chocolate Mousse.',
      actions: [{ type: 'SHOW_FILTERED_ITEMS', filter: 'vegetarian' }],
      suggestedItems: ['veggie_power_bowl', 'neon_caesar_salad', 'quantum_fries', 'stellar_chocolate_mousse'],
      normalizedIntent: 'Filter menu to vegetarian-friendly options'
    });
  }

  if (hasAny(lower, ['make everything less spicy', 'everything less spicy', 'make it mild'])) {
    const spicyCartItems = currentCart.filter(cartItem => (menu.find(item => item.id === cartItem.id)?.spiceLevel || 0) > 0);
    if (spicyCartItems.length === 0) {
      return buildResponse({
        assistantMessage: 'There are no spicy items in the cart right now.',
        actions: [{ type: 'NO_OP' }],
        suggestedItems: ['veggie_power_bowl', 'neon_caesar_salad'],
        normalizedIntent: 'Reduce spice across current cart'
      });
    }
    return buildResponse({
      assistantMessage: `I marked ${spicyCartItems.map(item => itemName(item.id)).join(', ')} as less spicy.`,
      actions: spicyCartItems.map(item => ({ type: 'UPDATE_MODIFIERS', itemId: item.id, notes: ['reduce spice'] })),
      suggestedItems: ['lunar_lemonade'],
      normalizedIntent: 'Reduce spice across current cart'
    });
  }

  if (lower.includes('burger') && !lower.includes('classic')) {
    return buildResponse({
      assistantMessage: 'I can add a burger, but I want to make sure I choose the right item.',
      actions: [{ type: 'NO_OP' }],
      needsClarification: true,
      clarificationQuestion: 'Do you mean the Classic Bistro Burger?',
      suggestedItems: ['classic_bistro_burger'],
      confidence: 0.58,
      normalizedIntent: 'Clarify ambiguous burger request'
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
    const cartHasItem = currentCart.some(cartItem => cartItem.id === item.id);
    const modifierOnly = cartHasItem && hasAny(lower, ['make', 'change', 'update', 'not spicy', 'less spicy', 'no sauce', 'without sauce', 'no onion', 'without onion']);
    if (removing) {
      actions.push({ type: 'REMOVE_ITEM', itemId: item.id });
      summaries.push(`removed ${item.name}`);
    } else if (modifierOnly) {
      const notes: string[] = [];
      if (lower.includes('no onion') || lower.includes('without onion')) notes.push('no onions');
      if (lower.includes('not spicy') || lower.includes('less spicy')) notes.push('reduce spice');
      if (lower.includes('no sauce') || lower.includes('without sauce')) notes.push('no sauce');
      const modifiers: Record<string, unknown> = {};
      if (lower.includes('large') && item.modifiers.sizes?.includes('large')) modifiers.size = 'large';
      actions.push({ type: 'UPDATE_MODIFIERS', itemId: item.id, modifiers, notes });
      summaries.push(`updated ${item.name}`);
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
      summaries.push(`added ${qty} ${pluralize(item.name, qty)}`);
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
    return buildResponse({
      assistantMessage: 'I can help with that. Try asking me to add, remove, modify, or filter menu items.',
      actions: [{ type: 'NO_OP' }],
      suggestedItems: ['spicy_chicken_sandwich', 'veggie_power_bowl'],
      confidence: 0.46,
      normalizedIntent: 'Unrecognized ordering request'
    });
  }

  return buildResponse({
    assistantMessage: `Done. I ${summaries.join(', ')}.`,
    actions,
    suggestedItems: ['lunar_lemonade', 'stellar_chocolate_mousse'],
    normalizedIntent: removing ? 'Remove requested menu items from cart' : 'Add or modify requested menu items'
  });
}
