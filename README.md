# Intelligent Bistro

A futuristic AI-powered restaurant ordering experience built for the Viridien AI Full-Stack Engineering Internship challenge.

The app combines a high-fidelity Expo React Native mobile interface with a Node.js backend that turns natural language ordering requests into structured, validated cart actions.

## What this demonstrates

- Premium mobile UI and interaction design
- AI-driven ordering through structured JSON actions
- Visible AI transaction trace: normalized intent, confidence, provider/model, cart diff, and JSON action preview
- Reliable cart state management through both UI and AI
- Backend schema validation with Zod
- OpenAI Structured Outputs support with deterministic fallback parser for demo reliability
- Clean monorepo structure
- Prompt-driven AI development workflow included in `/prompts`

## Stack

### Mobile

- Expo React Native
- TypeScript
- Expo Router
- Zustand
- Expo Linear Gradient
- Expo Blur
- Lucide React Native

### Backend

- Node.js
- Express
- TypeScript
- Zod
- OpenAI-compatible service layer
- Deterministic mock parser fallback

## Repo Structure

```txt
intelligent-bistro/
  apps/
    mobile/
      app/
      components/
      constants/
      services/
      store/
      types/
    backend/
      src/
        data/
        routes/
        schemas/
        services/
  prompts/
  README.md
```

## Running Locally

Install root dependencies:

```bash
npm install
```

Run backend:

```bash
cd apps/backend
npm install
npm run dev
```

Run mobile app in another terminal:

```bash
cd apps/mobile
npm install
npx expo start
```

For iOS simulator, press `i`. For Android, press `a`. You can also scan the Expo QR code using Expo Go.

Run the polished web demo locally:

```bash
npm run dev:backend
npm run dev:web
```

Then open:

```txt
http://localhost:8081
```

## Environment Variables

Backend supports optional OpenAI API usage. The app works without an API key because it includes a deterministic parser with the same response contract.

Create this file:

```bash
apps/backend/.env
```

Optional:

```env
OPENAI_API_KEY=your_api_key_here
AI_PROVIDER=openai
OPENAI_MODEL=gpt-4o-mini
PORT=4000
```

Without `OPENAI_API_KEY`, the backend automatically uses the deterministic parser.

## Demo Commands

Try these in the AI assistant:

```txt
Add two spicy chicken sandwiches and a large water
```

This is the core requirement demo. The assistant returns validated JSON actions and the UI shows the action trace, cart diff, and live order update.

```txt
Build the viral combo for two
```

```txt
Build me a high-protein lunch under $25
```

```txt
I want vegetarian and refreshing
```

```txt
Add fries and make my lemonade large
```

```txt
Remove the fries
```

```txt
Make the spicy chicken sandwich not spicy
```

```txt
Make everything less spicy
```

This demonstrates context-aware modification: the assistant reads the current cart and updates the existing spicy item instead of adding a duplicate.

```txt
Surprise me with the best order
```

```txt
Show me gluten-free options
```

```txt
Show me vegetarian options
```

```txt
Clear my cart
```

```txt
Add a burger
```

The last command demonstrates clarification handling.

## AI Development Workflow

I used Claude as a rapid full-stack development partner, but I treated it like an engineering accelerator, not a replacement for architecture decisions.

My prompting focused on:

- Defining the product requirements clearly
- Constraining the tech stack
- Requiring schema validation for AI output
- Separating frontend, backend, state, and AI parsing logic
- Prioritizing demo reliability through deterministic fallback parsing
- Iterating on visual polish and user experience

The prompts used during development are included in `/prompts`.

## Loom Walkthrough Suggested Flow

1. Show the futuristic home screen and menu cards.
2. Open the AI Order Brain and run: “Add two spicy chicken sandwiches and a large water.”
3. Show the conversation, normalized intent, confidence/provider chip, JSON action preview, and cart diff.
4. Show that the cart updated automatically.
5. Modify the cart using AI: “Make everything less spicy.”
6. Demonstrate recommendation logic: “Surprise me with the best order.”
7. Demonstrate clarification: “Add a burger.”
8. Show backend code: route, parser, Zod schema, OpenAI Structured Outputs path, deterministic fallback.
9. Explain prompt workflow in `/prompts`.

## Engineering Notes

This project intentionally keeps the deterministic fallback parser because internship demos should be reliable even when an external LLM key, rate limit, or network connection fails. If an API key is available, the backend calls OpenAI with Structured Outputs and validates the model result with the same Zod schema before the frontend applies cart mutations.
