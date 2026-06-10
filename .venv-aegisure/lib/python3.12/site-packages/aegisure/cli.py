from __future__ import annotations

import asyncio
import json
import os
import re
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Optional

import typer

from .agent_memory_export import build_memory_exports, export_content_is_current, write_memory_exports
from .attribution import append_attribution_ledger, attribution_records, infer_agent, query_attribution_ledger
from .constitution import load_constitution, write_constitution, constitution_for_repo
from .diff_filter import filter_ignored_files
from .diff_parser import parse_unified_diff
from .diff_risk import analyze_diff
from .policy_config import iter_repo_files, load_aegisure_policy, normalize_repo_path, path_is_ignored
from .policy_engine import evaluate_policy, policy_yaml_for_repo
from .privacy import detect_secret
from .provenance import build_commit_message, prompt_hash, read_commit_provenance, record_git_note
from .repair_prompt import generate_repair_prompt
from .second_opinion import cross_model_second_opinion, heuristic_second_opinion

app = typer.Typer(help="Aegisure: control and audit plane for AI coding agents.")
rewind_app = typer.Typer(help="Git-based rollback helpers.")
app.add_typer(rewind_app, name="rewind")


def _repo(path: str | Path = ".") -> Path:
    return Path(path).resolve()


def _selected_repo(repo: Path | None, path: Path | None) -> Path:
    return _repo(path or repo or ".")


def _run_git(repo: Path, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise typer.BadParameter(proc.stderr.strip() or proc.stdout.strip() or f"git {' '.join(args)} failed")
    return proc


def _is_git_repo(repo: Path) -> bool:
    return _run_git(repo, ["rev-parse", "--is-inside-work-tree"], check=False).returncode == 0


def _diff_text(repo: Path, *, staged: bool = False, base: Optional[str] = None, changed: bool = False) -> str:
    if base:
        proc = _run_git(repo, ["diff", f"{base}...HEAD"], check=False)
        return proc.stdout if proc.returncode == 0 else _run_git(repo, ["diff", base]).stdout
    if changed:
        env_base = os.getenv("GITHUB_BASE_REF") or os.getenv("AEGISURE_BASE_REF")
        candidates = [item for item in [env_base, f"origin/{env_base}" if env_base else None, "origin/main", "main", "HEAD~1"] if item]
        for candidate in candidates:
            proc = _run_git(repo, ["diff", f"{candidate}...HEAD"], check=False)
            if proc.returncode == 0:
                return proc.stdout
        return _run_git(repo, ["diff"]).stdout or _run_git(repo, ["diff", "--cached"]).stdout
    if staged:
        return _run_git(repo, ["diff", "--cached"]).stdout
    text = _run_git(repo, ["diff"]).stdout
    return text or _run_git(repo, ["diff", "--cached"]).stdout


def _filtered_parsed_diff(repo: Path, diff: str):
    policy = load_aegisure_policy(repo)
    return filter_ignored_files(parse_unified_diff(diff), repo, policy)


def _untracked_file_diff(repo: Path) -> str:
    proc = _run_git(repo, ["ls-files", "--others", "--exclude-standard"], check=False)
    if proc.returncode != 0:
        return ""
    chunks: list[str] = []
    policy = load_aegisure_policy(repo)
    for rel in [line.strip() for line in proc.stdout.splitlines() if line.strip()]:
        if path_is_ignored(repo, rel, policy):
            continue
        path = repo / rel
        if not path.is_file():
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        chunks.extend(
            [
                f"diff --git a/{rel} b/{rel}",
                "new file mode 100644",
                "index 0000000..1111111",
                "--- /dev/null",
                f"+++ b/{rel}",
                f"@@ -0,0 +1,{max(len(lines), 1)} @@",
            ]
        )
        chunks.extend(f"+{line}" for line in lines)
    return "\n".join(chunks) + ("\n" if chunks else "")


def _working_tree_diff_since(repo: Path, start_sha: str) -> str:
    tracked = _run_git(repo, ["diff", start_sha]).stdout
    untracked = _untracked_file_diff(repo)
    return tracked + ("\n" if tracked and untracked else "") + untracked


def _analysis_payload(repo: Path, diff: str) -> dict:
    parsed = _filtered_parsed_diff(repo, diff)
    constitution = constitution_for_repo(repo)
    report = analyze_diff(parsed, constitution=constitution)
    policy = evaluate_policy(parsed, policy_text=policy_yaml_for_repo(str(repo)), risk_report=report)
    payload = {**report.to_dict(), "policy_evaluation": policy.to_dict()}
    if any(violation.decision == "block" for violation in policy.violations):
        payload["verdict"] = "block"
    return payload


def _should_animate(*, json_output: bool = False, no_animation: bool = False, quiet: bool = False) -> bool:
    return bool(sys.stdout.isatty() and not os.getenv("CI") and not json_output and not no_animation and not quiet)


def _mark(message: str, *, enabled: bool) -> None:
    if enabled:
        typer.echo(f"◆ {message}")


def _session_file(repo: Path) -> Path:
    target = repo / ".aegisure"
    target.mkdir(parents=True, exist_ok=True)
    return target / "run-session.json"


def _history_file(repo: Path) -> Path:
    target = repo / ".aegisure"
    target.mkdir(parents=True, exist_ok=True)
    return target / "run-history.jsonl"


_DOC_PLACEHOLDER_RE = re.compile(
    r"(?i)(example|placeholder|your[_ -]?(?:api[_ -]?)?key|fake|dummy|sample|replace[_ -]?me|changeme|sk-live-fake|sk-proj-[a-z0-9_ -]*placeholder)"
)


def _doctor_secret_status(path: Path, text: str) -> str | None:
    if path.name in {".env.example", ".env.sample", ".env.template", ".env.dist"}:
        return "template" if detect_secret(text) else None
    if not detect_secret(text):
        return None
    if path.suffix.lower() in {".md", ".mdx", ".rst", ".txt"} and _DOC_PLACEHOLDER_RE.search(text):
        return "placeholder"
    return "real"


@app.command()
def init(
    repo: Path | None = typer.Argument(None, help="Repository to scan."),
    path: Path | None = typer.Option(None, "--path", help="Repository to scan."),
    overwrite: bool = typer.Option(False, help="Overwrite existing Aegisure.md."),
    no_animation: bool = typer.Option(False, "--no-animation", help="Disable interactive flourish."),
    quiet: bool = typer.Option(False, "--quiet", help="Only print the generated path."),
) -> None:
    """Scan a repository and generate the canonical Aegisure.md Constitution."""

    animate = _should_animate(no_animation=no_animation, quiet=quiet)
    repo_path = _selected_repo(repo, path)
    _mark("Reading repository shape", enabled=animate)
    target = write_constitution(repo_path, overwrite=overwrite)
    typer.echo(f"Generated {target}")


@app.command()
def export(
    repo: Path | None = typer.Argument(None, help="Repository to export memory files into."),
    path: Path | None = typer.Option(None, "--path", help="Repository to export memory files into."),
) -> None:
    """Export Aegisure.md into standard agent memory files."""

    results = write_memory_exports(_selected_repo(repo, path), overwrite=True)
    for result in results:
        marker = "updated" if result["changed"] else "unchanged"
        typer.echo(f"{marker}: {result['target']}")


@app.command()
def scan(
    repo: Path | None = typer.Argument(None, help="Repository to scan."),
    path: Path | None = typer.Option(None, "--path", help="Repository to scan."),
    staged: bool = typer.Option(False, "--staged", help="Analyze staged changes."),
    base: Optional[str] = typer.Option(None, "--base", help="Git ref to diff against."),
    changed: bool = typer.Option(False, "--changed", help="Analyze PR/CI changed files against a base ref."),
    json_output: bool = typer.Option(False, "--json", help="Emit JSON."),
) -> None:
    """Analyze a local diff using the LLM-free static core."""

    repo_path = _selected_repo(repo, path)
    diff = _diff_text(repo_path, staged=staged, base=base, changed=changed)
    payload = _analysis_payload(repo_path, diff)
    if json_output:
        typer.echo(json.dumps(payload, indent=2, sort_keys=True))
        if payload["verdict"] == "block":
            raise typer.Exit(1)
        return
    typer.echo(f"Aegisure verdict: {payload['verdict']} ({payload['score']}/100)")
    typer.echo(payload["summary"])
    for finding in payload["findings"]:
        location = f"{finding['path']}:{finding['line']}" if finding.get("line") else finding["path"]
        typer.echo(f"- {finding['severity'].upper()} {finding['category']} at {location}: {finding['explanation']}")
    policy = payload["policy_evaluation"]
    if not policy["passed"]:
        typer.echo("Policy violations:")
        for violation in policy["violations"]:
            typer.echo(f"- {violation['severity'].upper()} {violation['rule_id']}: {violation['explanation']}")
    if payload["verdict"] == "block":
        raise typer.Exit(1)


@app.command()
def repair(
    repo: Path | None = typer.Argument(None, help="Repository to inspect."),
    path: Path | None = typer.Option(None, "--path", help="Repository to inspect."),
    staged: bool = typer.Option(False, "--staged", help="Use staged diff."),
    agent: str = typer.Option("codex", "--agent", help="Target agent for the repair prompt."),
) -> None:
    """Generate a constrained repair prompt for the current risky diff."""

    repo_path = _selected_repo(repo, path)
    diff = _diff_text(repo_path, staged=staged)
    constitution = constitution_for_repo(repo_path)
    report = analyze_diff(_filtered_parsed_diff(repo_path, diff), constitution=constitution)
    prompt = generate_repair_prompt(risk_report=report, constitution=constitution, agent=agent)
    typer.echo(prompt.prompt)


@app.command()
def review(
    repo: Path | None = typer.Argument(None, help="Repository to inspect."),
    path: Path | None = typer.Option(None, "--path", help="Repository to inspect."),
    staged: bool = typer.Option(False, "--staged", help="Use staged diff."),
    provider: str = typer.Option("static", "--provider", help="static, anthropic, openai, or ollama."),
) -> None:
    """Run a second opinion on the current diff."""

    repo_path = _selected_repo(repo, path)
    diff = _diff_text(repo_path, staged=staged)
    filtered = _filtered_parsed_diff(repo_path, diff)
    if provider == "static":
        opinion = heuristic_second_opinion(filtered.raw)
    else:
        opinion = asyncio.run(cross_model_second_opinion(filtered.raw, author_agent="unknown", reviewer=provider))
    typer.echo(json.dumps(opinion.to_dict(), indent=2, sort_keys=True))


@app.command()
def commit(
    message: str = typer.Option(..., "-m", "--message", help="Commit message."),
    agent: str = typer.Option(..., "--agent", help="Agent name: codex, claude-code, cursor, copilot, cline, roo, human."),
    prompt: str = typer.Option(..., "--prompt", help="Prompt that produced the change."),
    repo: Path | None = typer.Option(None, "--repo", help="Repository to commit."),
    path: Path | None = typer.Option(None, "--path", help="Repository to commit."),
) -> None:
    """Create a git commit and capture provenance + attribution."""

    repo_path = _selected_repo(repo, path)
    final_message = build_commit_message(message, agent=agent, prompt=prompt)
    _run_git(repo_path, ["commit", "-m", final_message])
    sha = _run_git(repo_path, ["rev-parse", "HEAD"]).stdout.strip()
    record = read_commit_provenance(repo_path, sha)
    if record:
        record_git_note(repo_path, sha, record)
    diff = _run_git(repo_path, ["show", "--format=", "--find-renames", sha]).stdout
    parsed = parse_unified_diff(diff)
    ledger = attribution_records(parsed, repo=repo_path.name, change_id=prompt_hash(prompt), agent=infer_agent(explicit_agent=agent), source="cli_commit")
    append_attribution_ledger(repo_path, ledger)
    typer.echo(f"Committed {sha} and recorded {len(ledger)} attribution entries.")


@app.command()
def login(workspace: str = typer.Option("local", "--workspace", help="Workspace id or slug."), token: str = typer.Option("", "--token", help="Optional dashboard API token.")) -> None:
    """Store local workspace login metadata for CLI use."""

    from .state import record_audit_event
    from .storage.db import init_db

    init_db()
    record_audit_event({"workspace_id": workspace, "event_type": "cli_login", "message": "CLI workspace login configured.", "payload": {"token_configured": bool(token)}})
    typer.echo(f"CLI configured for workspace `{workspace}`. Static scans remain local-first.")


@app.command()
def doctor(
    repo: Path | None = typer.Argument(None, help="Repository to inspect."),
    path: Path | None = typer.Option(None, "--path", help="Repository to inspect."),
) -> None:
    """Read-only repository readiness check."""

    repo_path = _selected_repo(repo, path)
    checks: list[tuple[str, str, str]] = []

    def add(status: str, title: str, detail: str) -> None:
        checks.append((status, title, detail))
        typer.echo(f"{status.upper():4} {title} — {detail}")

    if _is_git_repo(repo_path):
        add("ok", "Git repository", "Aegisure can inspect diffs and gitignore rules.")
    else:
        add("fail", "Git repository", "Run inside a git repo before using Aegisure.")

    constitution_path = repo_path / "Aegisure.md"
    if constitution_path.exists():
        add("ok", "Aegisure.md", "Project Constitution is present.")
    else:
        add("warn", "Aegisure.md", "Missing; run `aegisure init`.")

    loaded = load_constitution(repo_path) if constitution_path.exists() else None
    expected_exports = build_memory_exports(loaded) if loaded else {}
    drifted = [
        target
        for target, content in expected_exports.items()
        if not export_content_is_current(target, (repo_path / target).read_text(encoding="utf-8") if (repo_path / target).exists() else None, content)
    ]
    if not constitution_path.exists():
        add("warn", "Agent memory exports", "Generate Aegisure.md first, then run `aegisure export`.")
    elif drifted:
        add("warn", "Agent memory exports", f"Drifted or missing: {', '.join(drifted)}. Run `aegisure export`.")
    else:
        add("ok", "Agent memory exports", "All six exported agent files are in sync.")

    secret_files = [".env", ".env.local", ".env.production", ".env.development"]
    unignored = [name for name in secret_files if not path_is_ignored(repo_path, name)]
    if unignored:
        add("warn", "Secret files gitignored", f"Not ignored yet: {', '.join(unignored)}.")
    else:
        add("ok", "Secret files gitignored", ".env-style files are ignored.")

    secrets = []
    doc_placeholders = []
    env_template_values = []
    for file in iter_repo_files(repo_path):
        if not file.is_file():
            continue
        try:
            text = file.read_text(encoding="utf-8", errors="replace")[:500_000]
        except Exception:
            continue
        status = _doctor_secret_status(file, text)
        if status == "real":
            secrets.append(normalize_repo_path(file.relative_to(repo_path)))
            if len(secrets) >= 5:
                break
        elif status == "placeholder":
            doc_placeholders.append(normalize_repo_path(file.relative_to(repo_path)))
        elif status == "template":
            env_template_values.append(normalize_repo_path(file.relative_to(repo_path)))
    if secrets:
        add("fail", "Committed/working-tree secrets", f"Potential secrets found in: {', '.join(secrets)}.")
    elif doc_placeholders:
        add("warn", "Documentation secret placeholders", f"Placeholder-looking secret examples found in: {', '.join(doc_placeholders[:5])}.")
        add("ok", "Committed/working-tree secrets", "No obvious real secrets found in non-ignored files.")
    elif env_template_values:
        add("info", "Environment template values", f"Secret-looking examples are present only in templates: {', '.join(env_template_values[:5])}.")
        add("ok", "Committed/working-tree secrets", "No obvious real secrets found in non-ignored files.")
    else:
        add("ok", "Committed/working-tree secrets", "No obvious secrets found in non-ignored files.")

    if (repo_path / ".aegisure" / "policy.yml").exists():
        add("ok", ".aegisure/policy.yml", "Repository policy file is present.")
    else:
        add("info", ".aegisure/policy.yml", "Not present; defaults are active.")

    workflow_files = [normalize_repo_path(path.relative_to(repo_path)) for path in iter_repo_files(repo_path) if normalize_repo_path(path.relative_to(repo_path)).startswith(".github/workflows/aegisure")]
    if any(path.endswith((".yml", ".yaml")) for path in workflow_files):
        add("ok", "GitHub Action", "Aegisure workflow is present.")
    else:
        add("info", "GitHub Action", "Not present; copy `.github/workflows/aegisure.yml.example`.")

    counts = {"ok": 0, "warn": 0, "fail": 0, "info": 0}
    for status, _, _ in checks:
        counts[status] += 1
    typer.echo(f"Summary: {counts['ok']} ok, {counts['warn']} warning, {counts['fail']} failures, {counts['info']} info.")
    if counts["fail"]:
        raise typer.Exit(1)


@rewind_app.command("last")
def rewind_last(
    repo: Path | None = typer.Option(None, "--repo", help="Repository to rewind."),
    path: Path | None = typer.Option(None, "--path", help="Repository to rewind."),
    yes: bool = typer.Option(False, "--yes", "-y", help="Confirm the git revert."),
) -> None:
    """Revert the most recent Aegisure-tagged commit with git revert."""

    repo_path = _selected_repo(repo, path)
    dirty = _run_git(repo_path, ["status", "--porcelain", "--untracked-files=no"]).stdout.strip()
    if dirty:
        typer.echo("Refusing to rewind because the working tree has uncommitted changes. Commit or stash first.")
        raise typer.Exit(1)
    sha = _run_git(repo_path, ["log", "--grep=Aegisure-Agent:", "-n", "1", "--format=%H"], check=False).stdout.strip()
    if not sha:
        rows = query_attribution_ledger(repo_path)
        sha = str(rows[-1].get("commit_sha", "")) if rows else ""
    if not sha:
        typer.echo("No Aegisure-committed change found to rewind.")
        raise typer.Exit(1)
    typer.echo(f"This is a git-based rollback. Aegisure will run: git revert --no-edit {sha}")
    if not yes and not typer.confirm("Create a revert commit now?"):
        typer.echo("Rewind cancelled.")
        return
    _run_git(repo_path, ["revert", "--no-edit", sha])
    typer.echo(f"Reverted {sha}.")


@app.command()
def run(
    repo: Path | None = typer.Argument(None, help="Repository to inspect."),
    path: Path | None = typer.Option(None, "--path", help="Repository to inspect."),
    end: bool = typer.Option(False, "--end", help="End the active session and scan produced changes."),
    json_output: bool = typer.Option(False, "--json", help="Emit JSON when ending a session."),
) -> None:
    """Start/end a git snapshot session; Aegisure does not execute agents."""

    repo_path = _selected_repo(repo, path)
    session_path = _session_file(repo_path)
    if not session_path.exists() and not end:
        head = _run_git(repo_path, ["rev-parse", "HEAD"]).stdout.strip()
        session = {"session_id": f"run_{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}", "repo": repo_path.name, "start_sha": head, "started_at": datetime.now(UTC).isoformat()}
        session_path.write_text(json.dumps(session, indent=2, sort_keys=True), encoding="utf-8")
        typer.echo(f"Started Aegisure run session {session['session_id']} at {head}. Do your agent work normally, then run `aegisure run --end`.")
        return
    if not session_path.exists() and end:
        typer.echo("No active Aegisure run session found.")
        raise typer.Exit(1)

    session = json.loads(session_path.read_text(encoding="utf-8"))
    diff = _working_tree_diff_since(repo_path, session["start_sha"])
    payload = _analysis_payload(repo_path, diff)
    record = {**session, "ended_at": datetime.now(UTC).isoformat(), "risk": payload}
    with _history_file(repo_path).open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True) + "\n")
    session_path.unlink()
    if json_output:
        typer.echo(json.dumps(record, indent=2, sort_keys=True))
    else:
        typer.echo(f"Ended Aegisure run session {session['session_id']}.")
        typer.echo(f"Verdict: {payload['verdict']} ({payload['score']}/100).")
        typer.echo("Aegisure did not execute or control the agent; this was a git snapshot scan.")
        if payload["verdict"] in {"block", "require_review"}:
            typer.echo("To roll back the last Aegisure-tagged commit, use `aegisure rewind last`.")
    if payload["verdict"] == "block":
        raise typer.Exit(1)


@app.command("help", context_settings={"allow_extra_args": True, "ignore_unknown_options": True})
def help_alias(ctx: typer.Context) -> None:
    """Show CLI help."""

    typer.echo(ctx.parent.get_help() if ctx.parent else ctx.get_help())


def main() -> None:
    app()


if __name__ == "__main__":
    main()
