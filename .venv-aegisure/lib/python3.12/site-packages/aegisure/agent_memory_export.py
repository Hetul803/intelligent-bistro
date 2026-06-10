from __future__ import annotations

from pathlib import Path

from .constitution import Constitution, constitution_for_repo, render_constitution


EXPORT_TARGETS = (
    "Aegisure.md",
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    ".clinerules",
    ".github/copilot-instructions.md",
)
CANONICAL_TARGET = "Aegisure.md"
BEGIN_MARKER = "<!-- AEGISURE:BEGIN -->"
END_MARKER = "<!-- AEGISURE:END -->"


def _rules_block(constitution: Constitution) -> str:
    return "\n".join(f"- {rule}" for rule in constitution.agent_rules)


def _approval_block(constitution: Constitution) -> str:
    return "\n".join(f"- {rule}" for rule in constitution.approval_rules)


def _test_block(constitution: Constitution) -> str:
    return "\n".join(f"- `{command}`" for command in constitution.test_commands) or "- No test command detected yet."


def _protected_block(constitution: Constitution) -> str:
    return "\n".join(f"- `{path}`" for path in constitution.protected_paths) or "- No protected paths detected yet."


def _attribution_instruction(agent: str) -> str:
    return (
        "When you commit work you produced, use Aegisure commit tagging so attribution is declared, not guessed: "
        f"`aegisure commit -m \"<message>\" --agent {agent} --prompt \"<prompt that produced this change>\"`."
    )


def build_memory_exports(constitution: Constitution) -> dict[str, str]:
    shared = {
        "repo": constitution.repo_name,
        "summary": constitution.summary,
        "rules": _rules_block(constitution),
        "approval": _approval_block(constitution),
        "tests": _test_block(constitution),
        "protected": _protected_block(constitution),
    }
    aura_md = render_constitution(constitution)
    agent_md = f"""# Agent Instructions for {shared['repo']}

{shared['summary']}

## Required Behavior
{shared['rules']}

## Human Approval Required
{shared['approval']}

## Protected Paths
{shared['protected']}

## Verification
{shared['tests']}

## Attribution
{_attribution_instruction("codex")}
"""
    claude_md = f"""# Claude Code Memory

You are working in `{shared['repo']}`.

Project summary: {shared['summary']}

Follow these non-negotiable rules:
{shared['rules']}

Before editing protected areas, ask for human review:
{shared['protected']}

Run or recommend these checks:
{shared['tests']}

Attribution:
{_attribution_instruction("claude-code")}
"""
    cursor_rules = f"""You are an AI coding agent in {shared['repo']}.

{shared['summary']}

Rules:
{shared['rules']}

Protected paths:
{shared['protected']}

Tests:
{shared['tests']}

Attribution:
{_attribution_instruction("cursor")}
"""
    cline_rules = f"""# Cline/Roo Rules

Repository: {shared['repo']}

{shared['summary']}

Do:
{shared['rules']}

Require approval:
{shared['approval']}

Verify with:
{shared['tests']}

Attribution:
{_attribution_instruction("cline")} Use `--agent roo` instead when Roo produced the change.
"""
    copilot = f"""# GitHub Copilot Instructions

This repository uses Aegisure as its project Constitution.

Summary: {shared['summary']}

Coding rules:
{shared['rules']}

Protected paths:
{shared['protected']}

Verification:
{shared['tests']}

Attribution:
{_attribution_instruction("copilot")}
"""
    return {
        "Aegisure.md": aura_md,
        "AGENTS.md": agent_md,
        "CLAUDE.md": claude_md,
        ".cursorrules": cursor_rules,
        ".clinerules": cline_rules,
        ".github/copilot-instructions.md": copilot,
    }


def _managed_block(content: str) -> str:
    return f"{BEGIN_MARKER}\n{content.rstrip()}\n{END_MARKER}\n"


def _extract_managed_block(text: str) -> str | None:
    if BEGIN_MARKER not in text or END_MARKER not in text:
        return None
    return text.split(BEGIN_MARKER, 1)[1].split(END_MARKER, 1)[0].strip()


def _merge_export_content(target: str, previous: str | None, generated: str) -> str:
    if target == CANONICAL_TARGET:
        return generated
    managed = _managed_block(generated)
    if previous is None or not previous.strip():
        return managed
    if previous.strip() == generated.strip():
        return managed
    if BEGIN_MARKER in previous and END_MARKER in previous:
        before = previous.split(BEGIN_MARKER, 1)[0].rstrip()
        after = previous.split(END_MARKER, 1)[1].lstrip()
        parts = [part for part in [before, managed.rstrip(), after.rstrip()] if part]
        return "\n\n".join(parts) + "\n"
    return previous.rstrip() + "\n\n" + managed


def export_content_is_current(target: str, previous: str | None, generated: str) -> bool:
    if previous is None:
        return False
    if target == CANONICAL_TARGET:
        return previous == generated
    managed = _extract_managed_block(previous)
    if managed is not None:
        return managed == generated.strip()
    return previous.strip() == generated.strip()


def write_memory_exports(repo_path: str | Path, *, overwrite: bool = True) -> list[dict[str, str | bool]]:
    repo = Path(repo_path).resolve()
    exports = build_memory_exports(constitution_for_repo(repo))
    results: list[dict[str, str | bool]] = []
    for target, content in exports.items():
        path = repo / target
        path.parent.mkdir(parents=True, exist_ok=True)
        previous = path.read_text(encoding="utf-8") if path.exists() else None
        next_content = _merge_export_content(target, previous, content)
        changed = previous != next_content
        if changed and (overwrite or previous is None):
            path.write_text(next_content, encoding="utf-8")
        results.append({"path": str(path), "target": target, "changed": changed})
    return results
