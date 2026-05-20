import { parseOrderWithAI } from '../services/llmParser.js';

type EvalCase = {
  name: string;
  message: string;
  cart?: unknown[];
  expectAction: string;
  expectItem?: string;
  expectClarification?: boolean;
};

const cases: EvalCase[] = [
  {
    name: 'adds multiple menu items from one sentence',
    message: 'Add two spicy chicken sandwiches and a large water',
    expectAction: 'ADD_ITEM',
    expectItem: 'spicy_chicken_sandwich'
  },
  {
    name: 'builds a goal-based combo',
    message: 'Build the viral combo for two',
    expectAction: 'ADD_ITEM',
    expectItem: 'lunar_lemonade'
  },
  {
    name: 'finds spicy food under budget',
    message: 'I want something spicy under 20 dollars',
    expectAction: 'ADD_ITEM',
    expectItem: 'spicy_chicken_sandwich'
  },
  {
    name: 'automatically removes spicy ingredient',
    message: 'I want the chicken sandwich but not spicy',
    expectAction: 'ADD_ITEM',
    expectItem: 'spicy_chicken_sandwich'
  },
  {
    name: 'filters dietary options',
    message: 'Show me vegetarian options',
    expectAction: 'SHOW_FILTERED_ITEMS'
  },
  {
    name: 'modifies an existing spicy cart item',
    message: 'Make everything less spicy',
    cart: [
      {
        id: 'spicy_chicken_sandwich',
        name: 'Spicy Chicken Sandwich',
        price: 14.5,
        quantity: 1
      }
    ],
    expectAction: 'UPDATE_MODIFIERS',
    expectItem: 'spicy_chicken_sandwich'
  },
  {
    name: 'asks for clarification on ambiguous burger',
    message: 'Add a burger',
    expectAction: 'NO_OP',
    expectClarification: true
  },
  {
    name: 'cancels placed orders from chat',
    message: 'Cancel my order',
    expectAction: 'CANCEL_ORDER'
  },
  {
    name: 'plans calorie constrained dinner for two',
    message: 'Build dinner for two under 900 calories each',
    expectAction: 'ADD_ITEM',
    expectItem: 'neon_caesar_salad'
  }
];

let failures = 0;

for (const testCase of cases) {
  const result = await parseOrderWithAI(testCase.message, testCase.cart || []);
  const actionMatch = result.actions.some(action => action.type === testCase.expectAction && (!testCase.expectItem || action.itemId === testCase.expectItem));
  const clarificationMatch = testCase.expectClarification === undefined || result.needsClarification === testCase.expectClarification;

  if (!actionMatch || !clarificationMatch) {
    failures += 1;
    console.error(`FAIL ${testCase.name}`);
    console.error(JSON.stringify(result, null, 2));
  } else {
    console.log(`PASS ${testCase.name}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
