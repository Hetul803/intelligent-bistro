<!-- AEGISURE:BEGIN -->
# Claude Code Memory

You are working in `aegisure-realtest`.

Project summary: Intelligent Bistro

Follow these non-negotiable rules:
- Inspect before editing; explain the smallest safe change.
- Do not remove tests or safety checks to make a task pass.
- Do not touch secrets, credentials, or private keys.
- Keep changes scoped to the requested task.
- Add or update regression tests for behavior changes.
- Ask for human approval before protected paths or high-risk actions.

Before editing protected areas, ask for human review:
- No protected paths detected yet.

Run or recommend these checks:
- `pnpm --dir apps/backend build`
- `pnpm --dir apps/backend typecheck`
- `pnpm --dir apps/mobile typecheck`
- `pnpm typecheck`

Attribution:
When you commit work you produced, use Aegisure commit tagging so attribution is declared, not guessed: `aegisure commit -m "<message>" --agent claude-code --prompt "<prompt that produced this change>"`.
<!-- AEGISURE:END -->
