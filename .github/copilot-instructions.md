<!-- AEGISURE:BEGIN -->
# GitHub Copilot Instructions

This repository uses Aegisure as its project Constitution.

Summary: Intelligent Bistro

Coding rules:
- Inspect before editing; explain the smallest safe change.
- Do not remove tests or safety checks to make a task pass.
- Do not touch secrets, credentials, or private keys.
- Keep changes scoped to the requested task.
- Add or update regression tests for behavior changes.
- Ask for human approval before protected paths or high-risk actions.

Protected paths:
- No protected paths detected yet.

Verification:
- `pnpm --dir apps/backend build`
- `pnpm --dir apps/backend typecheck`
- `pnpm --dir apps/mobile typecheck`
- `pnpm typecheck`

Attribution:
When you commit work you produced, use Aegisure commit tagging so attribution is declared, not guessed: `aegisure commit -m "<message>" --agent copilot --prompt "<prompt that produced this change>"`.
<!-- AEGISURE:END -->
