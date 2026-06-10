from __future__ import annotations

from pathlib import Path

from .diff_parser import ParsedDiff
from .policy_config import AegisurePolicy, path_is_ignored


def filter_ignored_files(parsed: ParsedDiff, repo_path: str | Path, policy: AegisurePolicy | None = None) -> ParsedDiff:
    kept = tuple(file for file in parsed.files if not path_is_ignored(repo_path, file.path, policy))
    return ParsedDiff(files=kept, raw=parsed.raw)
