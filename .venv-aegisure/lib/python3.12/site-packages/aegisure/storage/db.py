from __future__ import annotations

import sqlite3
from pathlib import Path

from .profile_paths import profile_dir

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS profile_meta(
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );""",
    """CREATE TABLE IF NOT EXISTS audit_log(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT,
      workspace_id TEXT,
      user_id TEXT,
      identity_id TEXT,
      event_type TEXT NOT NULL,
      action_type TEXT,
      risk_level TEXT DEFAULT 'info',
      approval_status TEXT DEFAULT 'not_required',
      message TEXT NOT NULL,
      payload_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );""",
    """CREATE TABLE IF NOT EXISTS model_usage_events(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      purpose TEXT,
      provider TEXT,
      model TEXT,
      route_reason TEXT,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      estimated_cost_usd REAL DEFAULT 0.0,
      saved_cost_usd REAL DEFAULT 0.0,
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );""",
    """CREATE TABLE IF NOT EXISTS identity_key_records(
      key_id TEXT PRIMARY KEY,
      identity_id TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      public_key_pem TEXT NOT NULL,
      encrypted_private_key_pem TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );""",
]


def db_path() -> Path:
    override = profile_dir() / "aegisure.sqlite3"
    override.parent.mkdir(parents=True, exist_ok=True)
    return override


def get_conn() -> sqlite3.Connection:
    init_db()
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> Path:
    path = db_path()
    conn = sqlite3.connect(path)
    try:
        for statement in SCHEMA:
            conn.execute(statement)
        conn.commit()
    finally:
        conn.close()
    return path
