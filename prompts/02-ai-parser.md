# Prompt 02 — AI Parser Reliability

Improve the AI ordering backend.

I do not want a fragile demo that only works when an external LLM behaves perfectly.

Create a parser system with:

- Zod schema validation
- strict action types
- no-key local ordering planner
- optional OpenAI-compatible LLM call
- optional Ollama local LLM call
- graceful fallback to local planning when an external provider fails
- support for add, remove, update quantity, update modifiers, clear cart, cancel order, filtering, calorie planning, and ambiguity clarification

The backend should return structured JSON every time.
