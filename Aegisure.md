# Aegisure Constitution for aegisure-realtest

Intelligent Bistro

## Purpose
This file is the project Constitution for AI coding agents. It tells Codex, Claude Code, Cursor, Copilot, Cline, Roo, and humans what must be preserved.

## Detected Stack
- TypeScript
- JavaScript

## Package And Build Files
- `apps/backend/package.json`
- `apps/mobile/package.json`
- `package.json`

## Test Commands
- `pnpm --dir apps/backend build`
- `pnpm --dir apps/backend typecheck`
- `pnpm --dir apps/mobile typecheck`
- `pnpm typecheck`

## Protected Paths
- `No protected paths detected yet`

## Agent Rules
- Inspect before editing; explain the smallest safe change.
- Do not remove tests or safety checks to make a task pass.
- Do not touch secrets, credentials, or private keys.
- Keep changes scoped to the requested task.
- Add or update regression tests for behavior changes.
- Ask for human approval before protected paths or high-risk actions.

## Approval Rules
- Payments, billing, auth, permissions, deploy config, and database migrations require human review.
- Deleting tests, weakening CORS, adding risky dependencies, or changing CI requires human review.
- Shell commands that are destructive or pipe remote scripts into a shell are blocked.

## Cross-Agent Memory Exports
- `Aegisure.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.cursorrules`
- `.clinerules`
- `.github/copilot-instructions.md`

<!-- AEGISURE_CONSTITUTION_JSON
{
  "agent_rules": [
    "Inspect before editing; explain the smallest safe change.",
    "Do not remove tests or safety checks to make a task pass.",
    "Do not touch secrets, credentials, or private keys.",
    "Keep changes scoped to the requested task.",
    "Add or update regression tests for behavior changes.",
    "Ask for human approval before protected paths or high-risk actions."
  ],
  "approval_rules": [
    "Payments, billing, auth, permissions, deploy config, and database migrations require human review.",
    "Deleting tests, weakening CORS, adding risky dependencies, or changing CI requires human review.",
    "Shell commands that are destructive or pipe remote scripts into a shell are blocked."
  ],
  "languages": [
    "TypeScript",
    "JavaScript"
  ],
  "memory_exports": [
    "Aegisure.md",
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    ".clinerules",
    ".github/copilot-instructions.md"
  ],
  "package_files": [
    "apps/backend/package.json",
    "apps/mobile/package.json",
    "package.json"
  ],
  "protected_paths": [],
  "repo_name": "aegisure-realtest",
  "schema_version": 1,
  "summary": "Intelligent Bistro",
  "test_commands": [
    "pnpm --dir apps/backend build",
    "pnpm --dir apps/backend typecheck",
    "pnpm --dir apps/mobile typecheck",
    "pnpm typecheck"
  ]
}
AEGISURE_CONSTITUTION_JSON -->
