from __future__ import annotations

import json
import re
from typing import Any


SECRET_VALUE_PATTERNS = [
    re.compile(r'(?i)\bbearer\s+([A-Za-z0-9_\-./+=]{24,})'),
    re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----.*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----', re.S),
    re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b'),
    re.compile(r'\bgh[pousr]_[A-Za-z0-9_]{20,}\b'),
    re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{20,}\b'),
    re.compile(r'\bAIza[0-9A-Za-z_-]{20,}\b'),
    re.compile(r'\bAKIA[0-9A-Z]{16}\b'),
]

ASSIGNED_SECRET_RE = re.compile(
    r'''(?ix)
    \b(?P<name>[A-Z0-9_]*?(?:api[_-]?key|secret[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|password|passwd|pwd)|apiKey|token)\b
    [ \t]*[:=][ \t]*
    (?P<quote>["']?)
    (?P<value>[^"'\s,;})\]\r\n]{4,})
    (?P=quote)
    '''
)

ENV_REFERENCE_RE = re.compile(
    r'''(?ix)
    ^(?:
      process\.env\.[A-Z0-9_]+|
      import\.meta\.env\.[A-Z0-9_]+|
      os\.environ(?:\.get)?\(?\[?["']?[A-Z0-9_]+|
      env\.[A-Z0-9_]+|
      settings\.[A-Za-z0-9_.]+|
      config\.[A-Za-z0-9_.]+|
      \$\{[A-Z0-9_]+\}
    )
    '''
)

PLACEHOLDER_RE = re.compile(
    r'(?i)^(?:your[_-]?(?:api[_-]?)?key(?:[_-]?here)?|placeholder|changeme|replace[_-]?me|example|sample|dummy|fake|<.*>|\"\"|\'\')$'
)

SENSITIVE_HINTS = {
    'ssn',
    'social security',
    'credit card',
    'card number',
    'bank account',
    'routing number',
    'passport',
    'private key',
    'confidential',
    'company confidential',
    'proprietary',
}

REDACTION = '[REDACTED]'


def _candidate_is_placeholder(value: str) -> bool:
    cleaned = value.strip().strip('"\'`')
    if not cleaned:
        return True
    lowered = cleaned.lower()
    return bool(PLACEHOLDER_RE.match(cleaned)) or any(marker in lowered for marker in ("your_api_key", "your-api-key", "placeholder", "replace_me", "changeme"))


def _candidate_is_env_reference(value: str) -> bool:
    return bool(ENV_REFERENCE_RE.match(value.strip().strip('"\'`')))


def _candidate_is_url(value: str) -> bool:
    cleaned = value.strip().strip('"\'`')
    return "://" in cleaned or cleaned.startswith(("http://", "https://"))


def _looks_high_entropy(value: str) -> bool:
    cleaned = value.strip().strip('"\'`')
    if len(cleaned) < 24 or _candidate_is_placeholder(cleaned) or _candidate_is_env_reference(cleaned) or _candidate_is_url(cleaned):
        return False
    classes = sum(
        bool(check(cleaned))
        for check in (
            lambda text: re.search(r'[a-z]', text),
            lambda text: re.search(r'[A-Z]', text),
            lambda text: re.search(r'\d', text),
            lambda text: re.search(r'[_./+=-]', text),
        )
    )
    unique_ratio = len(set(cleaned)) / max(len(cleaned), 1)
    return classes >= 3 and unique_ratio > 0.35


def _assigned_secret_values(text: str):
    for match in ASSIGNED_SECRET_RE.finditer(text):
        name = match.group("name").lower()
        value = match.group("value")
        if _candidate_is_env_reference(value) or _candidate_is_placeholder(value) or _candidate_is_url(value):
            continue
        is_password_literal = any(word in name for word in ("password", "passwd", "pwd")) and len(value.strip().strip('"\'`')) >= 8
        if is_password_literal or any(pattern.search(value) for pattern in SECRET_VALUE_PATTERNS) or _looks_high_entropy(value):
            yield match


def _secret_matches(text: str):
    if "://" in text and not any(prefix in text for prefix in ("sk-", "ghp_", "gho_", "ghs_", "ghu_", "ghr_", "xox", "AKIA", "AIza", "-----BEGIN")):
        yield from _assigned_secret_values(text)
        return
    for pattern in SECRET_VALUE_PATTERNS:
        yield from pattern.finditer(text)
    yield from _assigned_secret_values(text)


def detect_secret(text: str | None) -> bool:
    if not text:
        return False
    return any(_secret_matches(text))


def detect_sensitive(text: str | None) -> bool:
    if not text:
        return False
    lower = text.lower()
    return detect_secret(text) or any(hint in lower for hint in SENSITIVE_HINTS)


def redact_text(text: str | None, *, limit: int | None = None) -> str:
    if text is None:
        return ''
    redacted = str(text)
    for pattern in SECRET_VALUE_PATTERNS:
        redacted = pattern.sub(REDACTION, redacted)
    redacted = ASSIGNED_SECRET_RE.sub(
        lambda match: match.group(0).replace(match.group("value"), REDACTION)
        if any(inner.group(0) == match.group(0) for inner in _assigned_secret_values(match.group(0)))
        else match.group(0),
        redacted,
    )
    if limit is not None and len(redacted) > limit:
        redacted = redacted[:limit] + '\n...[truncated]'
    return redacted


def redact_value(value: Any, *, text_limit: int | None = 4000) -> Any:
    if isinstance(value, str):
        return redact_text(value, limit=text_limit)
    if isinstance(value, list):
        return [redact_value(item, text_limit=text_limit) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_value(item, text_limit=text_limit) for item in value)
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            key_text = str(key)
            if detect_sensitive(key_text):
                out[key] = REDACTION
            else:
                out[key] = redact_value(item, text_limit=text_limit)
        return out
    return value


def safe_json_dumps(value: Any) -> str:
    return json.dumps(redact_value(value), sort_keys=True, default=str)


def sensitivity_labels(text: str | None) -> list[str]:
    labels = []
    if detect_secret(text):
        labels.append('secret')
    if text and any(hint in text.lower() for hint in SENSITIVE_HINTS):
        labels.append('sensitive_personal_or_company_data')
    return labels
