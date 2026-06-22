from __future__ import annotations

import io
from pathlib import Path

from pydub import AudioSegment, effects


def _to_target(audio: AudioSegment, *, frame_rate: int, channels: int) -> AudioSegment:
    return audio.set_frame_rate(frame_rate).set_channels(channels).set_sample_width(2)


def load_wav_bytes(data: bytes, *, frame_rate: int, channels: int) -> AudioSegment:
    audio = AudioSegment.from_file(io.BytesIO(data), format="wav")
    return _to_target(audio, frame_rate=frame_rate, channels=channels)


def load_wav_path(path: str | Path, *, frame_rate: int, channels: int) -> AudioSegment:
    audio = AudioSegment.from_file(str(path), format="wav")
    return _to_target(audio, frame_rate=frame_rate, channels=channels)


def export_wav_bytes(audio: AudioSegment) -> bytes:
    buf = io.BytesIO()
    audio.export(buf, format="wav")
    return buf.getvalue()


def combine_sfx_and_tts(
    *,
    tts_wav: bytes,
    sfx_path: str | Path | None,
    frame_rate: int = 44100,
    channels: int = 2,
    gap_ms_after_sfx: int = 120,
    tts_gain_db: float = 0.0,
    sfx_gain_db: float = -2.0,
    master_gain_db: float = -1.0,
    normalize: bool = True,
) -> AudioSegment:
    voice = load_wav_bytes(tts_wav, frame_rate=frame_rate, channels=channels).apply_gain(tts_gain_db)
    gap = AudioSegment.silent(duration=max(0, int(gap_ms_after_sfx)), frame_rate=frame_rate).set_channels(channels)
    if sfx_path and Path(sfx_path).exists():
        sfx = load_wav_path(sfx_path, frame_rate=frame_rate, channels=channels).apply_gain(sfx_gain_db)
        audio = sfx + gap + voice
    else:
        audio = voice
    audio = audio.apply_gain(master_gain_db)
    if normalize:
        audio = effects.normalize(audio, headroom=1.0)
    return audio
