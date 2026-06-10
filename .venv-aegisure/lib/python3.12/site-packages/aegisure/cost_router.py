from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from .state import db_conn


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def estimate_tokens(text: str | None) -> int:
    if not text:
        return 0
    return max(1, len(text.split()) + len(text) // 24)


def estimate_cost(provider: str, model: str, prompt_tokens: int, completion_tokens: int) -> dict[str, Any]:
    pricing = {
        "anthropic": (0.0008, 0.004),
        "openai": (0.0006, 0.0024),
        "ollama": (0.0, 0.0),
    }
    input_rate, output_rate = pricing.get(provider, (0.0, 0.0))
    return {
        "estimated_cost_usd": round((prompt_tokens / 1000) * input_rate + (completion_tokens / 1000) * output_rate, 6),
        "known_pricing": provider in pricing,
    }


def record_model_usage(
    *,
    run_id: str | None,
    route: dict[str, Any],
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    prompt_tokens = int(prompt_tokens if prompt_tokens is not None else route.get("prompt_tokens_estimate") or 0)
    completion_tokens = int(completion_tokens if completion_tokens is not None else route.get("completion_tokens_estimate") or 0)
    cost = estimate_cost(str(route.get("provider") or ""), str(route.get("model") or ""), prompt_tokens, completion_tokens)
    row = {
        "run_id": run_id,
        "purpose": route.get("purpose"),
        "provider": route.get("provider"),
        "model": route.get("model"),
        "route_reason": route.get("route_reason"),
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "estimated_cost_usd": cost["estimated_cost_usd"],
        "saved_cost_usd": float(route.get("estimated_savings_vs_premium_usd") or 0),
        "metadata_json": json.dumps(metadata or {}, sort_keys=True),
    }
    with db_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO model_usage_events(
              run_id, purpose, provider, model, route_reason, prompt_tokens,
              completion_tokens, estimated_cost_usd, saved_cost_usd, metadata_json, created_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                row["run_id"],
                row["purpose"],
                row["provider"],
                row["model"],
                row["route_reason"],
                row["prompt_tokens"],
                row["completion_tokens"],
                row["estimated_cost_usd"],
                row["saved_cost_usd"],
                row["metadata_json"],
                _now(),
            ),
        )
        row["id"] = cur.lastrowid
    return row


def usage_summary() -> dict[str, Any]:
    rows = db_conn().execute("SELECT * FROM model_usage_events ORDER BY id DESC").fetchall()
    events = [dict(row) for row in rows]
    return {
        "events_count": len(events),
        "total_estimated_cost_usd": round(sum(float(row.get("estimated_cost_usd") or 0) for row in events), 6),
        "events": events,
    }
