from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv


@dataclass(frozen=True)
class RuntimeConfig:
    root_dir: Path
    raw: Dict[str, Any]

    @property
    def voicevox_base_url(self) -> str:
        return os.getenv("VOICEVOX_BASE_URL", self.raw.get("voicevox_base_url", "http://127.0.0.1:50021")).rstrip("/")

    @property
    def default_speaker_id(self) -> int:
        value = os.getenv("SEOYA_DEFAULT_SPEAKER_ID") or os.getenv("SE0YA_DEFAULT_SPEAKER_ID")
        return int(value if value is not None else self.raw.get("default_speaker_id", 3))

    @property
    def output_dir(self) -> Path:
        value = Path(self.raw.get("output_dir", "output"))
        return value if value.is_absolute() else self.root_dir / value

    def path_from_root(self, value: str | Path) -> Path:
        p = Path(value)
        return p if p.is_absolute() else self.root_dir / p


def load_config(config_path: str | Path = "config.json") -> RuntimeConfig:
    load_dotenv()
    path = Path(config_path)
    if not path.exists():
        # Allow running from a different cwd: app.py passes the package root config.
        path = Path(__file__).resolve().parents[1] / config_path
    with path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    root_dir = path.resolve().parent
    cfg = RuntimeConfig(root_dir=root_dir, raw=raw)
    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    return cfg
