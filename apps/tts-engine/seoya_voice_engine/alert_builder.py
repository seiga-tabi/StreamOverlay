from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from .config import RuntimeConfig
from .text_cleaner import clean_message, clean_name
from .voicevox_client import VoicevoxClient
from .wav_utils import combine_sfx_and_tts, export_wav_bytes

EventType = Literal["follow", "bits", "subscribe", "donation", "test"]


@dataclass
class AlertPayload:
    event_type: EventType = "test"
    name: str = "リスナー"
    amount: int | None = None
    message: str | None = None
    speaker_id: int | None = None
    with_sfx: bool = True
    save_file: bool = True


class AlertBuilder:
    def __init__(self, cfg: RuntimeConfig, templates_path: str | Path = "templates.json") -> None:
        self.cfg = cfg
        path = Path(templates_path)
        if not path.exists():
            path = cfg.root_dir / templates_path
        with path.open("r", encoding="utf-8") as f:
            self.templates: Dict[str, Any] = json.load(f)
        self.client = VoicevoxClient(cfg.voicevox_base_url)

    def _message_part(self, cleaned_message: str) -> str:
        if not cleaned_message:
            return ""
        patterns = self.templates.get("message_prefix", ["{message}"])
        return random.choice(patterns).format(message=cleaned_message)

    def build_text(self, payload: AlertPayload) -> str:
        limits = self.cfg.raw.get("limits", {})
        blocked_words = self.cfg.raw.get("blocked_words", [])
        overrides = self.cfg.raw.get("pronunciation_overrides", {})

        name = clean_name(payload.name, max_chars=int(limits.get("max_name_chars", 28)))
        message = clean_message(
            payload.message,
            max_chars=int(limits.get("max_message_chars", 140)),
            max_repeat_chars=int(limits.get("max_repeat_chars", 4)),
            blocked_words=blocked_words,
            pronunciation_overrides=overrides,
        )
        message_part = self._message_part(message)
        amount = payload.amount if payload.amount is not None else 0

        patterns = self.templates.get(payload.event_type) or self.templates.get("test")
        template = random.choice(patterns)
        return template.format(name=name, amount=amount, message=message, message_part=message_part).strip()

    def synthesize_alert(self, payload: AlertPayload) -> tuple[bytes, str, Optional[Path]]:
        text = self.build_text(payload)
        speaker_id = payload.speaker_id if payload.speaker_id is not None else self.cfg.default_speaker_id
        tts_wav = self.client.tts(text, speaker_id=speaker_id, voice_settings=self.cfg.raw.get("voice", {}))

        audio_cfg = self.cfg.raw.get("audio", {})
        sfx_path = None
        if payload.with_sfx:
            sfx_rel = self.cfg.raw.get("sfx", {}).get(payload.event_type)
            sfx_path = self.cfg.path_from_root(sfx_rel) if sfx_rel else None

        combined = combine_sfx_and_tts(
            tts_wav=tts_wav,
            sfx_path=sfx_path,
            frame_rate=int(audio_cfg.get("target_frame_rate", 44100)),
            channels=int(audio_cfg.get("target_channels", 2)),
            gap_ms_after_sfx=int(audio_cfg.get("gap_ms_after_sfx", 120)),
            tts_gain_db=float(audio_cfg.get("tts_gain_db", 0.0)),
            sfx_gain_db=float(audio_cfg.get("sfx_gain_db", -2.0)),
            master_gain_db=float(audio_cfg.get("master_gain_db", -1.0)),
            normalize=bool(audio_cfg.get("normalize", True)),
        )
        out_bytes = export_wav_bytes(combined)

        output_path: Optional[Path] = None
        if payload.save_file:
            ts = int(time.time() * 1000)
            safe_event = payload.event_type.replace("/", "_")
            output_path = self.cfg.output_dir / f"{safe_event}_{ts}.wav"
            output_path.write_bytes(out_bytes)
        return out_bytes, text, output_path
