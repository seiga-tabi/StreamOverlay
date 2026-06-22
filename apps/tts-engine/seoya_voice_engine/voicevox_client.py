from __future__ import annotations

from typing import Any, Dict, List, Mapping

import requests


class VoicevoxError(RuntimeError):
    pass


class VoicevoxClient:
    def __init__(self, base_url: str = "http://127.0.0.1:50021", timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        url = f"{self.base_url}{path}"
        try:
            resp = requests.request(method, url, timeout=self.timeout, **kwargs)
        except requests.RequestException as exc:
            raise VoicevoxError(f"VOICEVOX Engine에 연결할 수 없습니다: {url}. VOICEVOX를 먼저 실행하세요.") from exc
        if resp.status_code >= 400:
            raise VoicevoxError(f"VOICEVOX API 오류 {resp.status_code}: {resp.text[:500]}")
        return resp

    def version(self) -> str:
        return self._request("GET", "/version").text.strip().strip('"')

    def speakers(self) -> List[Dict[str, Any]]:
        return self._request("GET", "/speakers").json()

    def audio_query(self, text: str, speaker_id: int) -> Dict[str, Any]:
        resp = self._request(
            "POST",
            "/audio_query",
            params={"text": text, "speaker": speaker_id},
        )
        return resp.json()

    def synthesis(self, query: Mapping[str, Any], speaker_id: int) -> bytes:
        resp = self._request(
            "POST",
            "/synthesis",
            params={"speaker": speaker_id, "enable_interrogative_upspeak": "true"},
            json=dict(query),
            headers={"Content-Type": "application/json"},
        )
        return resp.content

    def tts(self, text: str, speaker_id: int, voice_settings: Mapping[str, Any] | None = None) -> bytes:
        query = self.audio_query(text, speaker_id)
        if voice_settings:
            for key, value in voice_settings.items():
                if key in query:
                    query[key] = value
        return self.synthesis(query, speaker_id)
