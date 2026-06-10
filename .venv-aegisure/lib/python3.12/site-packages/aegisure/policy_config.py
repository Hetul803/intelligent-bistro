from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass, field
from fnmatch import fnmatch
from pathlib import Path
from typing import Any, Iterable

import yaml


DEFAULT_IGNORE_PATTERNS = (
    ".venv/**",
    ".venv*/**",
    "venv/**",
    "venv*/**",
    "env/**",
    "node_modules/**",
    "**/node_modules/**",
    ".git/**",
    "__pycache__/**",
    "**/__pycache__/**",
    "*.pyc",
    "**/*.pyc",
    "dist/**",
    "build/**",
    ".next/**",
    ".turbo/**",
    ".mypy_cache/**",
    ".pytest_cache/**",
    "site-packages/**",
    "**/site-packages/**",
    "*.egg-info/**",
    "**/*.egg-info/**",
    ".DS_Store",
    "**/.DS_Store",
)

DEFAULT_PROTECTED_PATHS = (
    ".env*",
    ".github/workflows/**",
    "infra/**",
    "migrations/**",
    "alembic/**",
    "schema.sql",
    "pyproject.toml",
    "requirements.txt",
    "Dockerfile",
    "docker-compose.yml",
)

DEFAULT_APPROVAL_CATEGORIES = (
    "auth_change",
    "payment_logic_change",
    "risky_dependency_added",
    "deploy_config_change",
    "db_migration_without_migration_file",
    "constitution_violation",
)

DEFAULT_BLOCK_CATEGORIES = (
    "secret_in_diff",
    "destructive_shell_command",
)


@dataclass(frozen=True)
class AegisurePolicy:
    ignore: tuple[str, ...] = field(default_factory=lambda: tuple(DEFAULT_IGNORE_PATTERNS))
    protected_paths: tuple[str, ...] = field(default_factory=lambda: tuple(DEFAULT_PROTECTED_PATHS))
    approval_required: tuple[str, ...] = field(default_factory=lambda: tuple(DEFAULT_APPROVAL_CATEGORIES))
    block: tuple[str, ...] = field(default_factory=lambda: tuple(DEFAULT_BLOCK_CATEGORIES))

    def to_policy_yaml(self) -> str:
        rules: list[dict[str, Any]] = []
        if self.protected_paths:
            rules.append(
                {
                    "id": "protected_paths",
                    "description": "Protected paths require human review.",
                    "paths": list(self.protected_paths),
                    "decision": "require_review",
                    "severity": "high",
                }
            )
        if self.approval_required:
            rules.append(
                {
                    "id": "approval_required_categories",
                    "description": "These risk categories require human review.",
                    "categories": list(self.approval_required),
                    "decision": "require_review",
                    "severity": "high",
                }
            )
        if self.block:
            rules.append(
                {
                    "id": "blocked_categories",
                    "description": "These risk categories block by default.",
                    "categories": list(self.block),
                    "decision": "block",
                    "severity": "critical",
                }
            )
        return yaml.safe_dump({"rules": rules}, sort_keys=False)


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, Iterable) and not isinstance(value, dict):
        return [str(item) for item in value]
    return []


def _merge_patterns(defaults: tuple[str, ...], value: Any) -> tuple[str, ...]:
    if isinstance(value, dict):
        if value.get("replace") is not None:
            patterns = _as_list(value.get("replace"))
        else:
            remove = set(_as_list(value.get("remove")))
            patterns = [item for item in defaults if item not in remove]
        patterns.extend(_as_list(value.get("add")))
        return tuple(dict.fromkeys(patterns))
    if value is None:
        return defaults
    return tuple(dict.fromkeys([*defaults, *_as_list(value)]))


def load_aegisure_policy(repo_path: str | Path) -> AegisurePolicy:
    repo = Path(repo_path).resolve()
    path = repo / ".aegisure" / "policy.yml"
    if not path.exists():
        return AegisurePolicy()
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return AegisurePolicy()
    if not isinstance(data, dict):
        return AegisurePolicy()
    return AegisurePolicy(
        ignore=_merge_patterns(DEFAULT_IGNORE_PATTERNS, data.get("ignore")),
        protected_paths=tuple(dict.fromkeys(_as_list(data.get("protected_paths")) or list(DEFAULT_PROTECTED_PATHS))),
        approval_required=tuple(dict.fromkeys(_as_list(data.get("approval_required")) or list(DEFAULT_APPROVAL_CATEGORIES))),
        block=tuple(dict.fromkeys(_as_list(data.get("block")) or list(DEFAULT_BLOCK_CATEGORIES))),
    )


def normalize_repo_path(path: str | Path) -> str:
    return str(path).replace(os.sep, "/").lstrip("./")


def pattern_matches(path: str, pattern: str) -> bool:
    rel = normalize_repo_path(path)
    candidate = normalize_repo_path(pattern)
    if not candidate:
        return False
    if candidate.endswith("/**"):
        prefix = candidate[:-3].rstrip("/")
        return rel == prefix or rel.startswith(prefix + "/")
    if candidate.endswith("/"):
        prefix = candidate.rstrip("/")
        return rel == prefix or rel.startswith(prefix + "/")
    if "/" not in candidate:
        parts = rel.split("/")
        return candidate in parts or fnmatch(parts[-1], candidate)
    return fnmatch(rel, candidate)


def matches_any(path: str, patterns: Iterable[str]) -> bool:
    return any(pattern_matches(path, pattern) for pattern in patterns)


def _path_segments(rel: str) -> list[str]:
    return [part for part in normalize_repo_path(rel).split("/") if part and part != "."]


def _looks_like_virtualenv_path(repo: Path, rel: str) -> bool:
    parts = _path_segments(rel)
    if not parts:
        return False
    for index, segment in enumerate(parts):
        if segment.startswith(".venv") or segment.startswith("venv"):
            return True
        if segment == "env":
            env_root = repo / Path(*parts[: index + 1])
            if (env_root / "pyvenv.cfg").exists():
                return True
    if "site-packages" in parts:
        return True
    for index in range(len(parts)):
        candidate = repo / Path(*parts[: index + 1])
        if (candidate / "pyvenv.cfg").exists():
            return True
    return False


def _matches_builtin_segment_ignore(repo: Path, rel: str) -> bool:
    parts = _path_segments(rel)
    segment_ignores = {
        ".git",
        "node_modules",
        "__pycache__",
        "site-packages",
        "dist",
        "build",
        ".next",
        ".turbo",
        ".mypy_cache",
        ".pytest_cache",
    }
    if any(part in segment_ignores for part in parts):
        return True
    if any(part.endswith(".egg-info") for part in parts):
        return True
    if parts and re.search(r"\.py[co]$", parts[-1]):
        return True
    return _looks_like_virtualenv_path(repo, rel)


def _git_ignored(repo: Path, rel: str) -> bool:
    proc = subprocess.run(
        ["git", "check-ignore", "--quiet", "--no-index", "--", rel],
        cwd=repo,
        capture_output=True,
        text=True,
    )
    return proc.returncode == 0


def path_is_ignored(repo_path: str | Path, path: str | Path, policy: AegisurePolicy | None = None) -> bool:
    repo = Path(repo_path).resolve()
    path_obj = Path(path)
    rel = normalize_repo_path(path)
    if path_obj.is_absolute():
        try:
            rel = normalize_repo_path(path_obj.resolve().relative_to(repo))
        except ValueError:
            rel = normalize_repo_path(path_obj)
    active_policy = policy or load_aegisure_policy(repo)
    return _matches_builtin_segment_ignore(repo, rel) or matches_any(rel, DEFAULT_IGNORE_PATTERNS) or matches_any(rel, active_policy.ignore) or _git_ignored(repo, rel)


def filter_ignored_paths(repo_path: str | Path, paths: Iterable[str | Path], policy: AegisurePolicy | None = None) -> list[str]:
    repo = Path(repo_path).resolve()
    active_policy = policy or load_aegisure_policy(repo)
    kept: list[str] = []
    for item in paths:
        item_path = Path(item)
        if item_path.is_absolute():
            try:
                rel = normalize_repo_path(item_path.resolve().relative_to(repo))
            except ValueError:
                rel = normalize_repo_path(item_path)
        else:
            rel = normalize_repo_path(item)
        if not path_is_ignored(repo, rel, active_policy):
            kept.append(rel)
    return kept


def iter_repo_files(repo_path: str | Path, policy: AegisurePolicy | None = None) -> list[Path]:
    repo = Path(repo_path).resolve()
    active_policy = policy or load_aegisure_policy(repo)
    files: list[Path] = []
    for root, dirs, names in os.walk(repo):
        root_path = Path(root)
        rel_root = "." if root_path == repo else normalize_repo_path(root_path.relative_to(repo))
        kept_dirs = []
        for dirname in dirs:
            rel_dir = normalize_repo_path(dirname if rel_root == "." else f"{rel_root}/{dirname}")
            if not path_is_ignored(repo, rel_dir + "/", active_policy):
                kept_dirs.append(dirname)
        dirs[:] = kept_dirs
        for name in names:
            path = root_path / name
            rel = normalize_repo_path(path.relative_to(repo))
            if not path_is_ignored(repo, rel, active_policy):
                files.append(path)
    return files
