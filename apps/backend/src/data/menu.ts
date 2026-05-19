export type MenuItem = {
  id: string;
  name: string;
  category: 'Sandwiches' | 'Bowls' | 'Sides' | 'Drinks' | 'Desserts';
  description: string;
  price: number;
  image: string;
  tags: string[];
  spiceLevel: 0 | 1 | 2 | 3;
  calories: number;
  ingredients: string[];
  modifiers: {
    sizes?: string[];
    remove?: string[];
    addOns?: string[];
  };
};

export const menu: MenuItem[] = [
  {
    id: 'spicy_chicken_sandwich',
    name: 'Spicy Chicken Sandwich',
    category: 'Sandwiches',
    description: 'Crispy chicken, solar chili glaze, pickled slaw, toasted brioche.',
    price: 14.5,
    image: 'https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?q=80&w=1200&auto=format&fit=crop',
    tags: ['popular', 'spicy', 'protein'],
    spiceLevel: 3,
    calories: 720,
    ingredients: ['crispy chicken patty', 'solar chili glaze', 'pickled slaw', 'brioche bun'],
    modifiers: { remove: ['solar chili glaze', 'slaw', 'pickles'], addOns: ['ranch', 'cheese', 'avocado', 'extra chicken'] }
  },
  {
    id: 'classic_bistro_burger',
    name: 'Classic Bistro Burger',
    category: 'Sandwiches',
    description: 'Smash patty, aged cheddar, aioli, lettuce, tomato, soft bun.',
    price: 15.75,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=1200&auto=format&fit=crop',
    tags: ['classic', 'protein'],
    spiceLevel: 0,
    calories: 810,
    ingredients: ['smash patty', 'aged cheddar', 'aioli', 'lettuce', 'tomato', 'soft bun'],
    modifiers: { remove: ['cheese', 'aioli', 'tomato'], addOns: ['extra patty', 'bacon', 'avocado', 'ranch'] }
  },
  {
    id: 'veggie_power_bowl',
    name: 'Veggie Power Bowl',
    category: 'Bowls',
    description: 'Quinoa, avocado, roasted vegetables, edamame, citrus tahini.',
    price: 16.25,
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1200&auto=format&fit=crop',
    tags: ['vegetarian', 'healthy', 'gluten-free'],
    spiceLevel: 0,
    calories: 640,
    ingredients: ['quinoa', 'avocado', 'roasted vegetables', 'edamame', 'citrus tahini'],
    modifiers: { remove: ['onions', 'tahini', 'edamame'], addOns: ['tofu', 'egg', 'extra avocado'] }
  },
  {
    id: 'neon_caesar_salad',
    name: 'Neon Caesar Salad',
    category: 'Bowls',
    description: 'Romaine, parmesan crisp, herb croutons, lemon-pepper dressing.',
    price: 12.75,
    image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?q=80&w=1200&auto=format&fit=crop',
    tags: ['vegetarian', 'light'],
    spiceLevel: 0,
    calories: 510,
    ingredients: ['romaine', 'parmesan crisp', 'herb croutons', 'lemon-pepper dressing'],
    modifiers: { remove: ['croutons', 'parmesan', 'dressing'], addOns: ['chicken', 'tofu', 'avocado'] }
  },
  {
    id: 'quantum_fries',
    name: 'Quantum Fries',
    category: 'Sides',
    description: 'Crispy skin-on fries with smoked salt and orbital aioli.',
    price: 6.5,
    image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?q=80&w=1200&auto=format&fit=crop',
    tags: ['side', 'vegetarian'],
    spiceLevel: 0,
    calories: 430,
    ingredients: ['skin-on fries', 'smoked salt', 'orbital aioli'],
    modifiers: { sizes: ['small', 'regular', 'large'], addOns: ['cheese', 'chili dust', 'ranch'] }
  },
  {
    id: 'lunar_lemonade',
    name: 'Lunar Lemonade',
    category: 'Drinks',
    description: 'Fresh lemon, mint, sparkling water, subtle lavender glow.',
    price: 4.75,
    image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?q=80&w=1200&auto=format&fit=crop',
    tags: ['drink', 'refreshing'],
    spiceLevel: 0,
    calories: 140,
    ingredients: ['fresh lemon', 'mint', 'sparkling water', 'lavender syrup'],
    modifiers: { sizes: ['regular', 'large'], addOns: ['extra mint', 'less sugar'] }
  },
  {
    id: 'large_water',
    name: 'Large Water',
    category: 'Drinks',
    description: 'Filtered still water served chilled.',
    price: 2.5,
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?q=80&w=1200&auto=format&fit=crop',
    tags: ['drink'],
    spiceLevel: 0,
    calories: 0,
    ingredients: ['filtered still water', 'ice'],
    modifiers: { sizes: ['regular', 'large'], addOns: ['ice', 'lemon'] }
  },
  {
    id: 'stellar_chocolate_mousse',
    name: 'Stellar Chocolate Mousse',
    category: 'Desserts',
    description: 'Dark chocolate mousse, espresso dust, cosmic berry compote.',
    price: 8.25,
    image: 'https://images.unsplash.com/photo-1511911063855-2bf39afa5b2e?q=80&w=1200&auto=format&fit=crop',
    tags: ['dessert', 'vegetarian'],
    spiceLevel: 0,
    calories: 460,
    ingredients: ['dark chocolate mousse', 'espresso dust', 'berry compote'],
    modifiers: { remove: ['berry compote'], addOns: ['extra chocolate', 'cream'] }
  }
];
