from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from .storage.db import get_conn, init_db


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def db_conn():
    init_db()
    return get_conn()


def record_audit_event(event: dict[str, Any]) -> dict[str, Any]:
    payload = event.get("payload") or event.get("payload_json") or {}
    if isinstance(payload, str):
        payload_json = payload
    else:
        payload_json = json.dumps(payload, sort_keys=True)
    event_id = event.get("event_id") or f"audit_{uuid.uuid4().hex}"
    row = {
        "event_id": event_id,
        "workspace_id": event.get("workspace_id"),
        "user_id": event.get("user_id"),
        "identity_id": event.get("identity_id"),
        "event_type": event.get("event_type") or "audit_event",
        "action_type": event.get("action_type"),
        "risk_level": event.get("risk_level") or "info",
        "approval_status": event.get("approval_status") or "not_required",
        "message": event.get("message") or event.get("event_type") or "Aegisure audit event",
        "payload_json": payload_json,
        "created_at": event.get("created_at") or _now(),
    }
    with db_conn() as conn:
        conn.execute(
            """
            INSERT INTO audit_log(
              event_id, workspace_id, user_id, identity_id, event_type, action_type,
              risk_level, approval_status, message, payload_json, created_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                row["event_id"],
                row["workspace_id"],
                row["user_id"],
                row["identity_id"],
                row["event_type"],
                row["action_type"],
                row["risk_level"],
                row["approval_status"],
                row["message"],
                row["payload_json"],
                row["created_at"],
            ),
        )
    return row


def list_audit_events(limit: int = 100) -> list[dict[str, Any]]:
    rows = db_conn().execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    events = []
    for row in rows:
        data = dict(row)
        try:
            data["payload"] = json.loads(data.pop("payload_json") or "{}")
        except Exception:
            data["payload"] = {}
        events.append(data)
    return events
