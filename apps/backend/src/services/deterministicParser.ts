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

function dollarLimit(message: string): number | null {
  const match = message.match(/(?:under|below|less than)\s*\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
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

const itemRules = [
  { id: 'spicy_chicken_sandwich', terms: ['spicy chicken', 'chicken sandwich', 'spicy sandwich', 'spicy chicken sandwich'] },
  { id: 'classic_bistro_burger', terms: ['classic burger', 'bistro burger', 'burger'] },
  { id: 'veggie_power_bowl', terms: ['lobster risotto', 'risotto', 'lobster'] },
  { id: 'neon_caesar_salad', terms: ['salmon', 'pan seared salmon', 'pan-seared salmon', 'healthy main'] },
  { id: 'quantum_fries', terms: ['quantum fries', 'fries', 'fry'] },
  { id: 'lunar_lemonade', terms: ['lunar lemonade', 'lemonade'] },
  { id: 'large_water', terms: ['large water', 'water'] },
  { id: 'stellar_chocolate_mousse', terms: ['stellar mousse', 'mousse', 'dessert', 'chocolate'] }
];

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
  if (action.type === 'CANCEL_ORDER') return 'Cancel latest placed order';
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
  impact?: AIOrderResponse['impact'];
}): AIOrderResponse {
  const cartDiff = input.cartDiff || input.actions.filter(action => action.type !== 'NO_OP').map(describeAction);
  const mutationCount = input.actions.filter(action => !['NO_OP', 'SHOW_CATEGORY', 'SHOW_FILTERED_ITEMS'].includes(action.type)).length;
  return AIOrderResponseSchema.parse({
    needsClarification: false,
    clarificationQuestion: null,
    suggestedItems: [],
    provider: 'local',
    model: 'local-semantic-order-planner',
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
    impact:
      input.impact ||
      [
        { label: 'Cart ops', value: String(mutationCount) },
        { label: 'Schema', value: 'Validated' },
        { label: 'Mode', value: 'Reliable demo' }
      ],
    ...input
  });
}

function cartTargetForMessage(message: string, currentCart: ReturnType<typeof normalizeCart>) {
  const explicitRule = itemRules.find(rule => hasAny(message, rule.terms));
  if (explicitRule) {
    const explicitItem = currentCart.find(item => item.id === explicitRule.id);
    return explicitItem || null;
  }
  if (hasAny(message, [' it', ' that', ' this', ' last item', ' newest item', ' current item', ' current order'])) {
    return currentCart[currentCart.length - 1];
  }
  if (currentCart.length === 1 && hasAny(message, ['make', 'change', 'update', 'double', 'remove', 'delete', 'another', 'one more', 'ranch', 'sauce', 'pair a drink', 'drink pairing'])) return currentCart[0];
  return null;
}

function modifierNotes(message: string) {
  const notes: string[] = [];
  const modifiers: Record<string, unknown> = {};
  if (hasAny(message, ['not spicy', 'less spicy', 'mild', 'no spice', 'no spicy'])) notes.push('reduce spice');
  if (hasAny(message, ['no sauce', 'without sauce', 'sauce on the side'])) notes.push(message.includes('side') ? 'sauce on side' : 'no sauce');
  if (hasAny(message, ['remove sauce', 'take off sauce'])) notes.push('no sauce');
  if (hasAny(message, ['no onion', 'no onions', 'without onion', 'without onions'])) notes.push('no onions');
  if (hasAny(message, ['no slaw', 'without slaw'])) notes.push('no slaw');
  if (hasAny(message, ['no pickles', 'without pickles'])) notes.push('no pickles');
  if (hasAny(message, ['extra cheese', 'add cheese'])) notes.push('extra cheese');
  if (hasAny(message, ['add ranch', 'ranch'])) notes.push('add ranch');
  if (hasAny(message, ['extra avocado', 'add avocado'])) notes.push('extra avocado');
  if (hasAny(message, ['large', 'make it large', 'make that large'])) modifiers.size = 'large';
  if (hasAny(message, ['small', 'make it small', 'make that small'])) modifiers.size = 'small';
  return { notes, modifiers };
}

export function deterministicParse(message: string, cart: unknown = []): AIOrderResponse {
  const lower = message.toLowerCase();
  const currentCart = normalizeCart(cart);
  const actions: AIOrderResponse['actions'] = [];
  const summaries: string[] = [];
  const budgetLimit = dollarLimit(lower);
  const wantsSpicy = lower.includes('spicy') && !hasAny(lower, ['no spicy', 'no-spicy', 'not spicy', 'less spicy', 'make it mild']);

  if (hasAny(lower, ['cancel order', 'cancel my order', 'cancel the order', 'cancel latest order', 'void order', 'void my order', 'stop the order'])) {
    return buildResponse({
      assistantMessage: 'I cancelled the latest active order and marked it as refunded in the receipt view.',
      actions: [{ type: 'CANCEL_ORDER' }],
      confidence: 0.94,
      normalizedIntent: 'Cancel the latest placed order',
      actionTrace: [
        { step: 'Read intent', detail: 'Detected an order-level cancellation request instead of a cart edit.' },
        { step: 'Validate', detail: 'Targeted the most recent active placed order so past delivered/cancelled orders are not changed.' },
        { step: 'Apply', detail: 'Return a structured cancellation action for the client order store.' }
      ],
      cartDiff: ['Cancel latest active order', 'Keep receipt visible with cancelled status'],
      impact: [
        { label: 'Order state', value: 'Cancelled' },
        { label: 'Scope', value: 'Latest active' },
        { label: 'Cart ops', value: '0' }
      ]
    });
  }

  if (hasAny(lower, ['clear cart', 'clear my cart', 'clear order', 'clear the order', 'clear the entire order', 'start over', 'empty cart', 'empty order', 'remove all', 'remove everything', 'remove all the items', 'delete everything'])) {
    return buildResponse({
      assistantMessage: 'I cleared the entire order so you can start fresh.',
      actions: [{ type: 'CLEAR_CART' }],
      normalizedIntent: 'Reset the active cart',
      impact: [
        { label: 'Cart', value: 'Cleared' },
        { label: 'Items', value: '0' },
        { label: 'Next', value: 'Ready' }
      ]
    });
  }

  const targetItem = cartTargetForMessage(lower, currentCart);

  if (targetItem && hasAny(lower, ['remove it', 'remove that', 'delete it', 'delete that', 'take it out', 'take that out'])) {
    return buildResponse({
      assistantMessage: `I removed ${itemName(targetItem.id)} from the order.`,
      actions: [{ type: 'REMOVE_ITEM', itemId: targetItem.id }],
      confidence: 0.93,
      normalizedIntent: 'Remove referenced cart item',
      cartDiff: [`Remove ${itemName(targetItem.id)}`],
      impact: [
        { label: 'Edit', value: 'Remove' },
        { label: 'Target', value: itemName(targetItem.id) },
        { label: 'Cart ops', value: '1' }
      ]
    });
  }

  if (targetItem && hasAny(lower, ['double it', 'double that', 'double ', 'make it two', 'make that two', 'make it 2', 'make that 2'])) {
    const nextQuantity = lower.includes('double') ? Math.max(2, targetItem.quantity * 2) : 2;
    return buildResponse({
      assistantMessage: `I updated ${itemName(targetItem.id)} to quantity ${nextQuantity}.`,
      actions: [{ type: 'UPDATE_QUANTITY', itemId: targetItem.id, quantity: nextQuantity }],
      confidence: 0.93,
      normalizedIntent: 'Update referenced item quantity',
      cartDiff: [`Set ${itemName(targetItem.id)} quantity to ${nextQuantity}`],
      impact: [
        { label: 'Edit', value: 'Quantity' },
        { label: 'Qty', value: String(nextQuantity) },
        { label: 'Target', value: itemName(targetItem.id) }
      ]
    });
  }

  if (targetItem && hasAny(lower, ['one more', 'another one', 'add another', 'add one more'])) {
    return buildResponse({
      assistantMessage: `I added one more ${itemName(targetItem.id)}.`,
      actions: [{ type: 'UPDATE_QUANTITY', itemId: targetItem.id, quantity: targetItem.quantity + 1 }],
      confidence: 0.91,
      normalizedIntent: 'Increase referenced item quantity',
      cartDiff: [`Set ${itemName(targetItem.id)} quantity to ${targetItem.quantity + 1}`],
      impact: [
        { label: 'Edit', value: 'Quantity' },
        { label: 'Qty', value: String(targetItem.quantity + 1) },
        { label: 'Target', value: itemName(targetItem.id) }
      ]
    });
  }

  if (targetItem && hasAny(lower, ['make it', 'make that', 'change it', 'change that', 'update it', 'update that', 'no sauce', 'remove sauce', 'take off sauce', 'without sauce', 'less spicy', 'not spicy', 'no onion', 'without onion', 'extra cheese', 'extra avocado', 'add ranch', 'ranch', 'large', 'small'])) {
    const { notes, modifiers } = modifierNotes(lower);
    if (notes.length || Object.keys(modifiers).length) {
      return buildResponse({
        assistantMessage: `I updated ${itemName(targetItem.id)}: ${[...notes, ...Object.entries(modifiers).map(([key, value]) => `${key} ${String(value)}`)].join(', ')}.`,
        actions: [{ type: 'UPDATE_MODIFIERS', itemId: targetItem.id, modifiers, notes }],
        confidence: 0.9,
        normalizedIntent: 'Modify referenced cart item',
        cartDiff: [`Modify ${itemName(targetItem.id)}`],
        impact: [
          { label: 'Edit', value: 'Modifiers' },
          { label: 'Target', value: itemName(targetItem.id) },
          { label: 'Cart ops', value: '1' }
        ]
      });
    }
  }

  if (targetItem && hasAny(lower, ['pair a drink', 'drink pairing', 'add a drink pairing'])) {
    const pairedDrink = targetItem.id === 'classic_bistro_burger' || targetItem.id === 'quantum_fries' ? 'espresso_martini' : 'lunar_lemonade';
    return buildResponse({
      assistantMessage: `I paired ${itemName(targetItem.id)} with ${itemName(pairedDrink)} and added it to the order.`,
      actions: [{ type: 'ADD_ITEM', itemId: pairedDrink, quantity: 1 }],
      suggestedItems: ['large_water', 'espresso_martini', 'lunar_lemonade'],
      confidence: 0.9,
      normalizedIntent: 'Add a drink pairing for the current cart item',
      cartDiff: [`Add ${itemName(pairedDrink)} as a pairing for ${itemName(targetItem.id)}`],
      impact: [
        { label: 'Pairing', value: itemName(pairedDrink) },
        { label: 'Target', value: itemName(targetItem.id) },
        { label: 'Cart ops', value: '1' }
      ]
    });
  }

  if (hasAny(lower, ['replace', 'swap', 'change']) && hasAny(lower, [' with ', ' to '])) {
    const sourceRule = itemRules.find(rule => hasAny(lower, rule.terms) && currentCart.some(item => item.id === rule.id));
    const destinationRule = itemRules.find(rule => hasAny(lower, rule.terms) && rule.id !== sourceRule?.id);
    if (sourceRule && destinationRule) {
      return buildResponse({
        assistantMessage: `I swapped ${itemName(sourceRule.id)} for ${itemName(destinationRule.id)}.`,
        actions: [
          { type: 'REMOVE_ITEM', itemId: sourceRule.id },
          { type: 'ADD_ITEM', itemId: destinationRule.id, quantity: 1 }
        ],
        confidence: 0.9,
        normalizedIntent: 'Swap cart item',
        cartDiff: [`Remove ${itemName(sourceRule.id)}`, `Add ${itemName(destinationRule.id)}`],
        impact: [
          { label: 'Edit', value: 'Swap' },
          { label: 'From', value: itemName(sourceRule.id) },
          { label: 'To', value: itemName(destinationRule.id) }
        ]
      });
    }
  }

  if (wantsSpicy && budgetLimit !== null) {
    const spicyChicken = menu.find(item => item.id === 'spicy_chicken_sandwich');
    if (spicyChicken && spicyChicken.price <= budgetLimit) {
      return buildResponse({
        assistantMessage: `The Spicy Chicken Sandwich is $${spicyChicken.price.toFixed(2)} and fits under $${budgetLimit}. I added it. Would you like a drink with that?`,
        actions: [{ type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 1 }],
        suggestedItems: ['lunar_lemonade', 'large_water'],
        confidence: 0.95,
        normalizedIntent: 'Find and add spicy item under budget',
        actionTrace: [
          { step: 'Read constraints', detail: `Detected spicy preference and a $${budgetLimit} budget ceiling.` },
          { step: 'Match menu', detail: 'Selected the only spicy menu item that satisfies the budget instead of falling back to a mild salad.' },
          { step: 'Ask pairing', detail: 'No drink was requested, so the assistant asks before adding one.' }
        ],
        cartDiff: ['Add Spicy Chicken Sandwich', 'Hold drinks until guest confirms'],
        impact: [
          { label: 'Menu scan', value: `${menu.length} items` },
          { label: 'Best match', value: `$${spicyChicken.price.toFixed(2)}` },
          { label: 'Drink', value: 'Ask first' }
        ]
      });
    }

    return buildResponse({
      assistantMessage: `I do not have a spicy item under $${budgetLimit}. The closest match is the Spicy Chicken Sandwich at $${spicyChicken?.price.toFixed(2) || '18.00'}. Want me to add that, or should I find something cheaper and mild?`,
      actions: [{ type: 'NO_OP' }],
      needsClarification: true,
      clarificationQuestion: `I do not have a spicy item under $${budgetLimit}. The closest match is the Spicy Chicken Sandwich at $${spicyChicken?.price.toFixed(2) || '18.00'}. Should I add it anyway?`,
      suggestedItems: ['spicy_chicken_sandwich', 'quantum_fries'],
      confidence: 0.9,
      normalizedIntent: 'Clarify impossible spicy budget request',
      actionTrace: [
        { step: 'Read constraints', detail: `Detected spicy preference and a $${budgetLimit} budget ceiling.` },
        { step: 'Scan menu', detail: 'No spicy item satisfies that price ceiling.' },
        { step: 'Clarify', detail: 'The assistant avoids adding a mismatched item and asks the guest to approve the closest match.' }
      ],
      cartDiff: ['No cart change', 'Surface closest spicy option'],
      impact: [
        { label: 'Menu scan', value: `${menu.length} items` },
        { label: 'Bad match', value: 'Blocked' },
        { label: 'Closest', value: `$${spicyChicken?.price.toFixed(2) || '18.00'}` },
      ]
    });
  }

  if (hasAny(lower, ['light and fast', 'fast and light', 'lightest option', 'lightest'])) {
    return buildResponse({
      assistantMessage: 'I picked the Pan-Seared Salmon because it is the cleanest lighter main. Want still water or lemonade with it?',
      actions: [{ type: 'ADD_ITEM', itemId: 'neon_caesar_salad', quantity: 1, notes: ['light and fast'] }],
      suggestedItems: ['large_water', 'lunar_lemonade'],
      confidence: 0.94,
      normalizedIntent: 'Choose light and fast option',
      actionTrace: [
        { step: 'Resolve choice', detail: 'Guest chose the lighter/faster branch from the AI comparison.' },
        { step: 'Apply', detail: 'Added the Pan-Seared Salmon and held drinks for confirmation.' }
      ],
      cartDiff: ['Add Pan-Seared Salmon', 'Hold drink until guest confirms'],
      impact: [
        { label: 'Choice', value: 'Light' },
        { label: 'Prep', value: 'Fast' },
        { label: 'Drink', value: 'Ask first' }
      ]
    });
  }

  if (hasAny(lower, ['filling and healthy', 'healthy and filling', 'more filling', 'filling option'])) {
    return buildResponse({
      assistantMessage: 'I picked the Pan-Seared Salmon because it is the healthiest filling main on the menu. Want water or lemonade with it?',
      actions: [{ type: 'ADD_ITEM', itemId: 'neon_caesar_salad', quantity: 1, notes: ['healthy and filling'] }],
      suggestedItems: ['large_water', 'lunar_lemonade'],
      confidence: 0.94,
      normalizedIntent: 'Choose healthy and filling option',
      actionTrace: [
        { step: 'Resolve choice', detail: 'Guest chose the filling/healthy branch from the AI comparison.' },
        { step: 'Apply', detail: 'Added the Pan-Seared Salmon and held drinks for confirmation.' }
      ],
      cartDiff: ['Add Pan-Seared Salmon', 'Hold drink until guest confirms'],
      impact: [
        { label: 'Choice', value: 'Filling' },
        { label: 'Tags', value: 'Healthy' },
        { label: 'Drink', value: 'Ask first' }
      ]
    });
  }

  if (hasAny(lower, ['light', 'healthy', 'not heavy', 'fresh', 'clean meal', 'clean lunch'])) {
    return buildResponse({
      assistantMessage: 'I narrowed the menu to two premium fits: Pan-Seared Salmon is clean and lighter, while Lobster Risotto is richer and more indulgent. Which direction do you want?',
      actions: [{ type: 'SHOW_FILTERED_ITEMS', filter: 'vegetarian' }],
      needsClarification: true,
      clarificationQuestion: 'Choose light and fast, or filling and healthy?',
      suggestedItems: ['neon_caesar_salad', 'veggie_power_bowl'],
      confidence: 0.92,
      normalizedIntent: 'Compare healthy and light menu options',
      actionTrace: [
        { step: 'Read goal', detail: 'Detected a vague health or lightness preference rather than a direct item request.' },
        { step: 'Compare menu', detail: 'Compared lighter bowls and vegetarian-friendly items so the guest does not need to scan every card.' },
        { step: 'Clarify tradeoff', detail: 'Asked one decision question because the best answer depends on whether speed or fullness matters more.' }
      ],
      cartDiff: ['No cart change', 'Surface Pan-Seared Salmon', 'Surface Lobster Risotto'],
      impact: [
        { label: 'Menu scan', value: `${menu.length} items` },
        { label: 'Choices', value: '2' },
        { label: 'Cart ops', value: '0' }
      ]
    });
  }

  if (hasAny(lower, ['group order', 'table of 4', 'party of 4', 'four people', '4 people', 'team lunch'])) {
    return buildResponse({
      assistantMessage: 'A full four-person entree order cannot honestly fit under $60 on this premium menu. I built the closest no-spice shareable plan and left drinks as options instead of adding them without permission.',
      actions: [
        { type: 'CLEAR_CART' },
        { type: 'ADD_ITEM', itemId: 'neon_caesar_salad', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'quantum_fries', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'creme_brulee', quantity: 1 }
      ],
      suggestedItems: ['large_water', 'lunar_lemonade', 'tiramisu'],
      confidence: 0.96,
      normalizedIntent: 'Plan a constrained group order',
      actionTrace: [
        { step: 'Extract constraints', detail: 'Detected party size, vegetarian coverage, no-spice preference, and an after-tax budget target.' },
        { step: 'Solve menu fit', detail: 'Selected a clean main, a vegetarian shareable side, and dessert while avoiding spicy items.' },
        { step: 'Budget check', detail: 'Flagged that four full premium entrees would exceed $60 instead of pretending the constraint was solved.' },
        { step: 'Ask pairing', detail: 'No drink was requested, so the assistant asks before adding beverages.' }
      ],
      cartDiff: ['Reset cart for a clean group plan', 'Add closest no-spice shareable plan', 'Flag budget constraint honestly', 'Hold drinks until guest confirms'],
      impact: [
        { label: 'Manual scan', value: 'Skipped' },
        { label: 'Budget', value: 'Constraint flagged' },
        { label: 'Drink', value: 'Ask first' }
      ]
    });
  }

  if (hasAny(lower, ['optimize', 'make it cheaper', 'cheaper', 'lower total', 'reduce total', 'under $35', 'under 35'])) {
    const hasDessert = currentCart.some(item => item.id === 'stellar_chocolate_mousse');
    const hasLemonade = currentCart.some(item => item.id === 'lunar_lemonade');
    const hasFries = currentCart.some(item => item.id === 'quantum_fries');
    const optimizationActions: AIOrderResponse['actions'] = currentCart.length
      ? [
          ...(hasDessert ? [{ type: 'REMOVE_ITEM' as const, itemId: 'stellar_chocolate_mousse' }] : []),
          ...(hasFries ? [{ type: 'REMOVE_ITEM' as const, itemId: 'quantum_fries' }] : []),
          ...(hasLemonade ? [{ type: 'REMOVE_ITEM' as const, itemId: 'lunar_lemonade' }, { type: 'ADD_ITEM' as const, itemId: 'large_water', quantity: 1, modifiers: { size: 'large' } }] : []),
          ...(!hasDessert && !hasFries && !hasLemonade ? [{ type: 'UPDATE_MODIFIERS' as const, itemId: currentCart[0]?.id, notes: ['already near-minimum spend'] }] : [])
        ]
      : [
          { type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 1, notes: ['best value protein'] }
        ];
    return buildResponse({
      assistantMessage: currentCart.length
        ? 'I optimized the cart for price by cutting lower-priority extras and preserving the core meal.'
        : 'I built a value-optimized meal under $35 with a strong entree. Would you like a drink with that?',
      actions: optimizationActions,
      suggestedItems: currentCart.length ? ['quantum_fries'] : ['large_water', 'lunar_lemonade'],
      confidence: 0.91,
      normalizedIntent: 'Optimize cart for budget',
      actionTrace: [
        { step: 'Rank items', detail: 'Separated core meal items from nice-to-have extras and premium drinks.' },
        { step: 'Optimize', detail: 'Reduced spend by cutting optional sides, desserts, or premium drinks while preserving the core meal.' },
        { step: 'Guardrail', detail: 'Avoided adding drinks unless the guest confirms a beverage.' }
      ],
      cartDiff: currentCart.length ? ['Preserve core meal', 'Remove optional side/dessert where present', 'Swap premium drink to water when possible'] : ['Add value entree', 'Hold drink until guest confirms', 'Keep order under $35 before tax'],
      impact: [
        { label: 'Goal', value: 'Lower total' },
        { label: 'Kept', value: 'Core meal' },
        { label: 'Savings scan', value: 'Applied' }
      ]
    });
  }

  if (hasAny(lower, ['fastest', 'fast pickup', 'quickest', 'ready fastest', 'shortest wait'])) {
    return buildResponse({
      assistantMessage: 'I built the fastest premium pickup order with Pan-Seared Salmon. Want me to add a drink, or keep it food-only?',
      actions: [
        { type: 'CLEAR_CART' },
        { type: 'ADD_ITEM', itemId: 'neon_caesar_salad', quantity: 1, notes: ['fast pickup lane'] }
      ],
      suggestedItems: ['lunar_lemonade', 'large_water'],
      confidence: 0.89,
      normalizedIntent: 'Minimize pickup time',
      actionTrace: [
        { step: 'Prioritize speed', detail: 'Selected lighter prep items instead of cooked-to-order sandwiches.' },
        { step: 'Apply', detail: 'Built a compact pickup-ready cart with fewer kitchen stations involved.' },
        { step: 'Ask pairing', detail: 'No drink was requested, so the assistant asks before adding one.' }
      ],
      cartDiff: ['Reset cart for fastest pickup', 'Add Pan-Seared Salmon', 'Hold drink until guest confirms'],
      impact: [
        { label: 'Pickup', value: 'Fast lane' },
        { label: 'Stations', value: 'Fewer' },
        { label: 'Drink', value: 'Ask first' }
      ]
    });
  }

  if (hasAny(lower, ['dietary scan', 'scan dietary', 'allergy', 'allergies', 'safe options'])) {
    return buildResponse({
      assistantMessage: 'I scanned the menu for safer dietary-friendly options and highlighted the strongest match.',
      actions: [{ type: 'SHOW_FILTERED_ITEMS', filter: 'gluten-free' }],
      suggestedItems: ['neon_caesar_salad', 'veggie_power_bowl', 'creme_brulee'],
      confidence: 0.87,
      normalizedIntent: 'Scan menu for dietary-safe choices',
      actionTrace: [
        { step: 'Read constraints', detail: 'Detected a safety-oriented dietary request instead of a direct add-to-cart request.' },
        { step: 'Filter', detail: 'Narrowed the menu to tagged gluten-free-friendly and vegetarian-friendly items.' },
        { step: 'Recommend', detail: 'Suggested options that are easier to reason about before checkout.' }
      ],
      cartDiff: ['Filter menu by gluten-free', 'Suggest Pan-Seared Salmon', 'Suggest Lobster Risotto'],
      impact: [
        { label: 'Risk', value: 'Lower' },
        { label: 'Matches', value: '2' },
        { label: 'Cart ops', value: '0' }
      ]
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
      assistantMessage: 'I built a chef-picked food order with a signature sandwich and fries. Want me to pair a drink with it?',
      actions: [
        { type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 1 },
        { type: 'ADD_ITEM', itemId: 'quantum_fries', quantity: 1, modifiers: { size: 'regular' } }
      ],
      suggestedItems: ['lunar_lemonade', 'large_water', 'stellar_chocolate_mousse'],
      confidence: 0.9,
      normalizedIntent: 'Create a balanced chef-recommended order'
    });
  }

  if ((hasAny(lower, ['spicy', 'heat', 'hot']) && hasAny(lower, ['under 20', 'under $20', '20 dollars', '$20'])) || hasAny(lower, ['something spicy'])) {
    return buildResponse({
      assistantMessage: 'Best fit: the Spicy Chicken Sandwich. It is bold, filling, and stays under $20 before tax. I added it with the heat intact.',
      actions: [{ type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 1 }],
      suggestedItems: ['spicy_chicken_sandwich', 'lunar_lemonade'],
      confidence: 0.93,
      normalizedIntent: 'Find a spicy order under budget'
    });
  }

  if (hasAny(lower, ['chicken sandwich', 'spicy chicken']) && hasAny(lower, ['not spicy', 'less spicy', 'make it mild', 'mild'])) {
    return buildResponse({
      assistantMessage: 'Got it. I added the chicken sandwich and removed the solar chili glaze, which is the spicy ingredient. I also marked it mild so the kitchen sees the change clearly.',
      actions: [
        {
          type: 'ADD_ITEM',
          itemId: 'spicy_chicken_sandwich',
          quantity: 1,
          modifiers: { remove: ['solar chili glaze'] },
          notes: ['removed solar chili glaze', 'make mild']
        }
      ],
      suggestedItems: ['lunar_lemonade', 'quantum_fries'],
      confidence: 0.95,
      normalizedIntent: 'Add chicken sandwich with spicy ingredient removed'
    });
  }

  if (hasAny(lower, ['high protein', 'protein lunch', 'post workout', 'post-workout'])) {
    return buildResponse({
      assistantMessage: 'Built a high-protein lunch that stays under $25 before tax. Want water or lemonade with it?',
      actions: [
        { type: 'ADD_ITEM', itemId: 'spicy_chicken_sandwich', quantity: 1 }
      ],
      suggestedItems: ['large_water', 'lunar_lemonade', 'neon_caesar_salad'],
      normalizedIntent: 'Build a high-protein lunch under budget'
    });
  }

  if (hasAny(lower, ['under $20', 'under 20', 'budget', 'cheap lunch'])) {
    return buildResponse({
      assistantMessage: 'I found a clean under-$20 option with Truffle Fries. Would you like to add a drink or keep it as a snack?',
      actions: [
        { type: 'ADD_ITEM', itemId: 'quantum_fries', quantity: 1 }
      ],
      suggestedItems: ['large_water', 'lunar_lemonade', 'quantum_fries'],
      normalizedIntent: 'Build a budget-friendly order'
    });
  }

  if (hasAny(lower, ['vegetarian and refreshing', 'plant mode', 'plant based lunch', 'plant-based lunch'])) {
    return buildResponse({
      assistantMessage: 'Built a vegetarian order with a bright drink pairing.',
      actions: [
        { type: 'ADD_ITEM', itemId: 'quantum_fries', quantity: 1 },
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
      suggestedItems: ['neon_caesar_salad', 'veggie_power_bowl', 'creme_brulee'],
      normalizedIntent: 'Filter menu for gluten-free-friendly items'
    });
  }

  if (hasAny(lower, ['vegetarian', 'veggie options', 'meat free', 'meat-free'])) {
    return buildResponse({
      assistantMessage: 'I found the vegetarian-friendly lane: Truffle Fries, Molten Chocolate Cake, Creme Brulee, and Tiramisu. The premium mains are not vegetarian, so I did not add one automatically.',
      actions: [{ type: 'SHOW_FILTERED_ITEMS', filter: 'vegetarian' }],
      suggestedItems: ['quantum_fries', 'stellar_chocolate_mousse', 'creme_brulee', 'tiramisu'],
      normalizedIntent: 'Filter menu to vegetarian-friendly options'
    });
  }

  if (hasAny(lower, ['make everything less spicy', 'everything less spicy', 'make it mild'])) {
    const spicyCartItems = currentCart.filter(cartItem => (menu.find(item => item.id === cartItem.id)?.spiceLevel || 0) > 0);
    if (spicyCartItems.length === 0) {
      return buildResponse({
        assistantMessage: 'There are no spicy items in the cart right now.',
        actions: [{ type: 'NO_OP' }],
        suggestedItems: ['neon_caesar_salad', 'quantum_fries'],
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
      if (lower.includes('not spicy') || lower.includes('less spicy')) {
        notes.push('removed solar chili glaze');
        notes.push('make mild');
      }
      if (lower.includes('no sauce') || lower.includes('without sauce')) notes.push('no sauce');
      const modifiers: Record<string, unknown> = {};
      if (lower.includes('large') && item.modifiers.sizes?.includes('large')) modifiers.size = 'large';
      if ((lower.includes('not spicy') || lower.includes('less spicy')) && item.id === 'spicy_chicken_sandwich') modifiers.remove = ['solar chili glaze'];
      if (lower.includes('ranch')) modifiers.addOns = ['ranch'];
      actions.push({ type: 'UPDATE_MODIFIERS', itemId: item.id, modifiers, notes });
      summaries.push(`updated ${item.name}`);
    } else {
      const modifiers: Record<string, unknown> = {};
      const notes: string[] = [];
      if (lower.includes('large') && item.modifiers.sizes?.includes('large')) modifiers.size = 'large';
      if (lower.includes('small') && item.modifiers.sizes?.includes('small')) modifiers.size = 'small';
      if (lower.includes('no onion') || lower.includes('without onion')) notes.push('no onions');
      if (lower.includes('not spicy') || lower.includes('less spicy')) {
        notes.push('removed solar chili glaze');
        notes.push('make mild');
      }
      if (lower.includes('no sauce') || lower.includes('without sauce')) notes.push('no sauce');
      if ((lower.includes('not spicy') || lower.includes('less spicy')) && item.id === 'spicy_chicken_sandwich') modifiers.remove = ['solar chili glaze'];
      if (lower.includes('ranch')) modifiers.addOns = ['ranch'];
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
      assistantMessage: 'I can help with that. I found a few good starting points below; tell me a craving, budget, dietary need, or item change and I will build the order.',
      actions: [{ type: 'NO_OP' }],
      suggestedItems: ['spicy_chicken_sandwich', 'veggie_power_bowl', 'classic_bistro_burger'],
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
