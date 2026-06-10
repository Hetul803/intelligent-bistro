from __future__ import annotations

import re
import shlex

from .privacy import detect_secret

SENSITIVE_ACTION_WORDS = {"send", "delete", "pay", "purchase", "checkout", "upload", "export", "deploy"}
HIGH_RISK_TOKENS = {"rm", "del", "rmdir", "mv", "chmod", "chown", "sudo", "su", "mkfs", "diskutil", "dd", "powershell", "pwsh"}
LOW_RISK_COMMANDS = {"ls", "pwd", "git status", "git log", "git diff", "git branch", "git remote", "git rev-parse"}
MEDIUM_RISK_COMMAND_PREFIXES = {"npm install", "pnpm install", "pip install", "python -m pip install", "git checkout", "git switch", "git pull", "git fetch"}

BLOCKED_PATTERNS = [
    re.compile(r"(?i)\brm\s+-[^;&|]*r[^;&|]*\s+(/|~|\$HOME|/Users|/System|/Library)\b"),
    re.compile(r"(?i)\bdd\s+.*\bof=/dev/"),
    re.compile(r"(?i)\b(mkfs|diskpart|format)\b"),
    re.compile(r"(?i)\bcurl\b.*\|\s*(bash|sh|zsh|powershell|pwsh)\b"),
    re.compile(r"(?i)\bwget\b.*\|\s*(bash|sh|zsh|powershell|pwsh)\b"),
    re.compile(r"(?i)\b(env|printenv|cat)\b.*\|\s*(curl|nc|netcat)\b"),
]


def requires_confirmation(action: str) -> bool:
    lowered = (action or "").lower()
    return any(word in lowered for word in SENSITIVE_ACTION_WORDS)


def classify_shell_command(command: str, workspace: str | None = None) -> dict:
    """Classify shell risk without executing the command.

    This is the static, LLM-free Guardian core used by CLI scans, GitHub PR checks,
    and backend policy decisions. It intentionally does not depend on desktop-era
    tool registries or learned runtime state.
    """

    command = (command or "").strip()
    lowered = re.sub(r"\s+", " ", command.lower())
    if not command:
        return {"risk": "blocked", "requires_approval": False, "blocked": True, "reason": "empty_shell_command"}
    if detect_secret(command):
        return {"risk": "blocked", "requires_approval": False, "blocked": True, "reason": "command_contains_secret"}
    if any(pattern.search(command) for pattern in BLOCKED_PATTERNS):
        return {"risk": "blocked", "requires_approval": False, "blocked": True, "reason": "destructive_or_exfiltrating_shell_command"}

    try:
        tokens = shlex.split(command)
    except ValueError:
        tokens = command.split()

    first = tokens[0].lower() if tokens else ""
    first_two = " ".join(token.lower() for token in tokens[:2])

    if first == "rm" and any("r" in token.lower().lstrip("-") for token in tokens[1:] if token.startswith("-")):
        dangerous_targets = {"/", "~", "$HOME", "/Users", "/System", "/Library"}
        targets = [token for token in tokens[1:] if not token.startswith("-")]
        if any(target in dangerous_targets or target.startswith(("/Users/", "/System/", "/Library/")) for target in targets):
            return {"risk": "blocked", "requires_approval": False, "blocked": True, "reason": "destructive_or_exfiltrating_shell_command"}

    if first in HIGH_RISK_TOKENS or first_two in HIGH_RISK_TOKENS:
        return {"risk": "high", "requires_approval": True, "blocked": False, "reason": f"high_risk_shell_command:{first_two or first}"}
    if lowered.startswith("git push"):
        return {"risk": "high", "requires_approval": True, "blocked": False, "reason": "github_push_requires_approval"}
    if lowered.startswith("git clone"):
        unsafe_target = any(token.startswith(("/", "~")) for token in tokens[2:] if not token.startswith("http"))
        risk = "medium" if unsafe_target and not workspace else "low"
        return {"risk": risk, "requires_approval": risk != "low", "blocked": False, "reason": "git_clone_safe_workspace" if risk == "low" else "git_clone_absolute_target"}
    if lowered in LOW_RISK_COMMANDS or any(lowered.startswith(cmd + " ") for cmd in LOW_RISK_COMMANDS):
        return {"risk": "low", "requires_approval": False, "blocked": False, "reason": "read_only_shell_command"}
    if first_two in MEDIUM_RISK_COMMAND_PREFIXES or any(lowered.startswith(cmd + " ") for cmd in MEDIUM_RISK_COMMAND_PREFIXES):
        return {"risk": "medium", "requires_approval": True, "blocked": False, "reason": "dependency_or_branch_change"}
    if any(marker in lowered for marker in [">", ">>", " tee ", " cp ", " mkdir ", " touch "]):
        return {"risk": "medium", "requires_approval": True, "blocked": False, "reason": "shell_command_may_write_files"}

    return {"risk": "medium", "requires_approval": True, "blocked": False, "reason": "unclassified_shell_command_requires_review"}


def guard_step(step, task_type: str | None = None) -> str:
    if getattr(step, "action_type", "") == "CODE_RUN" and (getattr(step, "args", None) or {}).get("kind") == "shell":
        classification = classify_shell_command((getattr(step, "args", None) or {}).get("command", ""))
        if classification["blocked"]:
            return "blocked"
        if classification["requires_approval"]:
            return "confirm"
    if requires_confirmation(getattr(step, "name", "") or getattr(step, "action_type", "")):
        return "confirm"
    return "allow"
