# Prompt 02 — AI Parser Reliability

Improve the AI ordering backend.

I do not want a fragile demo that only works when the LLM behaves perfectly.

Create a parser system with:

- Zod schema validation
- strict action types
- deterministic fallback parser
- optional OpenAI-compatible LLM call
- graceful fallback to deterministic parsing when the LLM fails
- support for add, remove, update quantity, update modifiers, clear cart, vegetarian filtering, and ambiguity clarification

The backend should return structured JSON every time.
