from __future__ import annotations

import html
import re
import unicodedata
from typing import Mapping, Sequence

URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
SPACE_RE = re.compile(r"\s+")
# Keep Japanese, Korean, Latin, numbers, common punctuation, and Twitch-like symbols.
SAFE_NAME_RE = re.compile(r"[^0-9A-Za-z_\-\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]+")
# Most emoji live outside the BMP or in symbol ranges. We remove them for predictable TTS.
EMOJIish_RE = re.compile(
    "["
    "\U0001F1E6-\U0001F1FF"  # flags
    "\U0001F300-\U0001F5FF"
    "\U0001F600-\U0001F64F"
    "\U0001F680-\U0001F6FF"
    "\U0001F700-\U0001F77F"
    "\U0001F780-\U0001F7FF"
    "\U0001F800-\U0001F8FF"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FAFF"
    "\u2600-\u27BF"
    "]+",
    flags=re.UNICODE,
)


def _limit_repeats(text: str, max_repeat_chars: int) -> str:
    if max_repeat_chars < 1:
        return text
    # Any character repeated more than max_repeat_chars gets truncated.
    return re.sub(r"(.)\1{%d,}" % max_repeat_chars, lambda m: m.group(1) * max_repeat_chars, text)


def apply_pronunciation_overrides(text: str, overrides: Mapping[str, str]) -> str:
    # Longest keys first, so "8888" beats "888".
    for src in sorted(overrides.keys(), key=len, reverse=True):
        dst = overrides[src]
        text = text.replace(src, dst)
    return text


def contains_blocked_word(text: str, blocked_words: Sequence[str]) -> bool:
    lowered = text.lower()
    return any(word and word.lower() in lowered for word in blocked_words)


def clean_message(
    message: str | None,
    *,
    max_chars: int = 140,
    max_repeat_chars: int = 4,
    blocked_words: Sequence[str] = (),
    pronunciation_overrides: Mapping[str, str] | None = None,
) -> str:
    if not message:
        return ""
    text = html.unescape(str(message))
    text = unicodedata.normalize("NFKC", text)
    text = URL_RE.sub("リンク", text)
    text = CONTROL_RE.sub(" ", text)
    text = EMOJIish_RE.sub(" ", text)
    text = _limit_repeats(text, max_repeat_chars)
    text = SPACE_RE.sub(" ", text).strip()
    if pronunciation_overrides:
        text = apply_pronunciation_overrides(text, pronunciation_overrides)
    if contains_blocked_word(text, blocked_words):
        return "このメッセージは読み上げできません。"
    if len(text) > max_chars:
        text = text[:max_chars].rstrip() + "。以下省略。"
    return text


def clean_name(name: str | None, *, max_chars: int = 28) -> str:
    if not name:
        return "リスナー"
    text = html.unescape(str(name))
    text = unicodedata.normalize("NFKC", text)
    text = SAFE_NAME_RE.sub("", text)
    text = text.strip("_- ")
    if not text:
        return "リスナー"
    return text[:max_chars]
