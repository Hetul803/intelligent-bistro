export type Category = 'Sandwiches' | 'Bowls' | 'Sides' | 'Drinks' | 'Desserts';

export type MenuItem = {
  id: string;
  name: string;
  category: Category;
  description: string;
  price: number;
  image: string;
  tags: string[];
  spiceLevel: 0 | 1 | 2 | 3;
  modifiers: {
    sizes?: string[];
    remove?: string[];
    addOns?: string[];
  };
};

export type CartItem = MenuItem & {
  quantity: number;
  modifiers?: Record<string, unknown>;
  notes?: string[];
  lastTouchedAt?: number;
};

export type AIAction = {
  type: 'ADD_ITEM' | 'REMOVE_ITEM' | 'UPDATE_QUANTITY' | 'UPDATE_MODIFIERS' | 'CLEAR_CART' | 'SHOW_CATEGORY' | 'SHOW_FILTERED_ITEMS' | 'NO_OP';
  itemId?: string;
  quantity?: number;
  category?: string;
  filter?: string;
  modifiers?: Record<string, unknown>;
  notes?: string[];
};

export type AIResponse = {
  assistantMessage: string;
  actions: AIAction[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  suggestedItems: string[];
};
