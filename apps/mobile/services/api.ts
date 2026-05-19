import { AIChatMessage, AIResponse, CartItem } from '../types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export async function sendAIOrder(message: string, cart: CartItem[], conversation: AIChatMessage[] = []): Promise<AIResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ai/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      cart,
      conversation: conversation.slice(-8).map(turn => ({
        role: turn.role,
        content: turn.content
      }))
    })
  });

  if (!response.ok) throw new Error('Backend rejected the AI request');
  return response.json();
}
