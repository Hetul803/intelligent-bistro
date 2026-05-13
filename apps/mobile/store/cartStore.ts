import { create } from 'zustand';
import { menu } from '../constants/menu';
import { AIAction, CartItem, MenuItem } from '../types';

type CartSnapshot = CartItem[];

type CartStore = {
  items: CartItem[];
  lastAssistantMessage: string;
  activeFilter: string | null;
  history: CartSnapshot[];
  addItem: (item: MenuItem, quantity?: number, modifiers?: Record<string, unknown>, notes?: string[]) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  applyActions: (actions: AIAction[], assistantMessage: string) => void;
  undo: () => void;
  subtotal: () => number;
  tax: () => number;
  total: () => number;
};

function mergeModifiers(existing?: Record<string, unknown>, next?: Record<string, unknown>) {
  return { ...(existing || {}), ...(next || {}) };
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  lastAssistantMessage: 'Tell me what you want. I can add, remove, modify, or filter your order.',
  activeFilter: null,
  history: [],

  addItem: (item, quantity = 1, modifiers = {}, notes = []) => {
    const current = get().items;
    const existing = current.find(i => i.id === item.id);
    const snapshot = [...current];
    if (existing) {
      set({
        history: [...get().history, snapshot],
        items: current.map(i =>
          i.id === item.id
            ? {
                ...i,
                quantity: i.quantity + quantity,
                modifiers: mergeModifiers(i.modifiers, modifiers),
                notes: Array.from(new Set([...(i.notes || []), ...notes])),
                lastTouchedAt: Date.now()
              }
            : i
        )
      });
      return;
    }
    set({
      history: [...get().history, snapshot],
      items: [...current, { ...item, quantity, modifiers, notes, lastTouchedAt: Date.now() }]
    });
  },

  removeItem: itemId => {
    set({ history: [...get().history, [...get().items]], items: get().items.filter(i => i.id !== itemId) });
  },

  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) return get().removeItem(itemId);
    set({
      history: [...get().history, [...get().items]],
      items: get().items.map(i => (i.id === itemId ? { ...i, quantity, lastTouchedAt: Date.now() } : i))
    });
  },

  clearCart: () => {
    set({ history: [...get().history, [...get().items]], items: [], activeFilter: null });
  },

  applyActions: (actions, assistantMessage) => {
    const snapshot = [...get().items];
    let nextItems = [...get().items];
    let nextFilter: string | null = get().activeFilter;

    for (const action of actions) {
      if (action.type === 'NO_OP') continue;
      if (action.type === 'CLEAR_CART') {
        nextItems = [];
        nextFilter = null;
      }
      if (action.type === 'SHOW_FILTERED_ITEMS') {
        nextFilter = action.filter || null;
      }
      if (action.type === 'SHOW_CATEGORY') {
        nextFilter = action.category || null;
      }
      if (!action.itemId) continue;
      const item = menu.find(m => m.id === action.itemId);
      if (action.type === 'REMOVE_ITEM') nextItems = nextItems.filter(i => i.id !== action.itemId);
      if (action.type === 'ADD_ITEM' && item) {
        const existing = nextItems.find(i => i.id === item.id);
        if (existing) {
          nextItems = nextItems.map(i =>
            i.id === item.id
              ? {
                  ...i,
                  quantity: i.quantity + (action.quantity || 1),
                  modifiers: mergeModifiers(i.modifiers, action.modifiers),
                  notes: Array.from(new Set([...(i.notes || []), ...(action.notes || [])])),
                  lastTouchedAt: Date.now()
                }
              : i
          );
        } else {
          nextItems.push({ ...item, quantity: action.quantity || 1, modifiers: action.modifiers || {}, notes: action.notes || [], lastTouchedAt: Date.now() });
        }
      }
      if (action.type === 'UPDATE_QUANTITY') {
        nextItems = nextItems.map(i => (i.id === action.itemId ? { ...i, quantity: action.quantity || i.quantity, lastTouchedAt: Date.now() } : i));
      }
      if (action.type === 'UPDATE_MODIFIERS') {
        nextItems = nextItems.map(i =>
          i.id === action.itemId
            ? {
                ...i,
                modifiers: mergeModifiers(i.modifiers, action.modifiers),
                notes: Array.from(new Set([...(i.notes || []), ...(action.notes || [])])),
                lastTouchedAt: Date.now()
              }
            : i
        );
      }
    }

    set({
      history: [...get().history, snapshot].slice(-10),
      items: nextItems,
      activeFilter: nextFilter,
      lastAssistantMessage: assistantMessage
    });
  },

  undo: () => {
    const history = get().history;
    const previous = history[history.length - 1];
    if (!previous) return;
    set({ items: previous, history: history.slice(0, -1), lastAssistantMessage: 'Undone. I restored the previous cart state.' });
  },

  subtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  tax: () => get().subtotal() * 0.0825,
  total: () => get().subtotal() + get().tax()
}));
