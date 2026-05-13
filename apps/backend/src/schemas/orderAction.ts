import { z } from 'zod';

export const CartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  modifiers: z.record(z.any()).optional(),
  notes: z.array(z.string()).optional()
});

export const OrderActionSchema = z.object({
  type: z.enum([
    'ADD_ITEM',
    'REMOVE_ITEM',
    'UPDATE_QUANTITY',
    'UPDATE_MODIFIERS',
    'CLEAR_CART',
    'SHOW_CATEGORY',
    'SHOW_FILTERED_ITEMS',
    'NO_OP'
  ]),
  itemId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  category: z.string().optional(),
  filter: z.string().optional(),
  modifiers: z.record(z.any()).optional(),
  notes: z.array(z.string()).optional()
});

export const AIOrderResponseSchema = z.object({
  assistantMessage: z.string(),
  actions: z.array(OrderActionSchema),
  needsClarification: z.boolean().default(false),
  clarificationQuestion: z.string().nullable().default(null),
  suggestedItems: z.array(z.string()).default([])
});

export type AIOrderResponse = z.infer<typeof AIOrderResponseSchema>;
