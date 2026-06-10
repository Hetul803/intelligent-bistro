<!-- AEGISURE:BEGIN -->
# Agent Instructions for aegisure-realtest

Intelligent Bistro

## Required Behavior
- Inspect before editing; explain the smallest safe change.
- Do not remove tests or safety checks to make a task pass.
- Do not touch secrets, credentials, or private keys.
- Keep changes scoped to the requested task.
- Add or update regression tests for behavior changes.
- Ask for human approval before protected paths or high-risk actions.

## Human Approval Required
- Payments, billing, auth, permissions, deploy config, and database migrations require human review.
- Deleting tests, weakening CORS, adding risky dependencies, or changing CI requires human review.
- Shell commands that are destructive or pipe remote scripts into a shell are blocked.

## Protected Paths
- No protected paths detected yet.

## Verification
- `pnpm --dir apps/backend build`
- `pnpm --dir apps/backend typecheck`
- `pnpm --dir apps/mobile typecheck`
- `pnpm typecheck`

## Attribution
When you commit work you produced, use Aegisure commit tagging so attribution is declared, not guessed: `aegisure commit -m "<message>" --agent codex --prompt "<prompt that produced this change>"`.
<!-- AEGISURE:END -->
