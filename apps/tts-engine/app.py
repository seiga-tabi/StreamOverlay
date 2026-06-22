from __future__ import annotations

from pathlib import Path
from typing import Any, Literal, Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, Response
from pydantic import BaseModel, Field

from seoya_voice_engine.alert_builder import AlertBuilder, AlertPayload
from seoya_voice_engine.config import load_config
from seoya_voice_engine.voicevox_client import VoicevoxError
from seoya_voice_engine.wav_utils import combine_sfx_and_tts, export_wav_bytes

cfg = load_config("config.json")
builder = AlertBuilder(cfg)
app = FastAPI(title="Seoya Broadcast Japanese TTS Engine", version="1.0.0")

EventType = Literal["follow", "bits", "subscribe", "donation", "test"]


def as_dict(model: BaseModel) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=300)
    speaker_id: Optional[int] = None
    with_sfx: bool = False
    save_file: bool = True


class AlertRequest(BaseModel):
    event_type: EventType = "test"
    name: str = "リスナー"
    amount: Optional[int] = None
    message: Optional[str] = None
    speaker_id: Optional[int] = None
    with_sfx: bool = True
    save_file: bool = True


@app.get("/health")
def health() -> dict:
    try:
        version = builder.client.version()
    except VoicevoxError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"ok": True, "voicevox_version": version, "output_dir": str(cfg.output_dir)}


@app.get("/speakers")
def speakers() -> list:
    try:
        return builder.client.speakers()
    except VoicevoxError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/speak")
def speak(req: SpeakRequest) -> Response:
    try:
        # Exact text TTS. Set with_sfx=true to attach the generic test SFX.
        speaker_id = req.speaker_id if req.speaker_id is not None else cfg.default_speaker_id
        tts_wav = builder.client.tts(req.text, speaker_id=speaker_id, voice_settings=cfg.raw.get("voice", {}))
        out_wav = tts_wav

        if req.with_sfx:
            audio_cfg = cfg.raw.get("audio", {})
            sfx_rel = cfg.raw.get("sfx", {}).get("test")
            sfx_path = cfg.path_from_root(sfx_rel) if sfx_rel else None
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
            out_wav = export_wav_bytes(combined)

        if req.save_file:
            path = cfg.output_dir / "last_speak.wav"
            path.write_bytes(out_wav)
        return Response(content=out_wav, media_type="audio/wav", headers={"X-Seoya-TTS-Text": quote(req.text, safe="")})
    except VoicevoxError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/alert")
def alert(req: AlertRequest) -> Response:
    try:
        wav, text, output_path = builder.synthesize_alert(AlertPayload(**as_dict(req)))
        headers = {"X-Seoya-Read-Text": quote(text, safe="")}
        if output_path:
            headers["X-Seoya-Output-Path"] = str(output_path)
        return Response(content=wav, media_type="audio/wav", headers=headers)
    except VoicevoxError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/alert_file")
def alert_file(req: AlertRequest) -> dict:
    try:
        data = as_dict(req)
        data["save_file"] = True
        wav, text, output_path = builder.synthesize_alert(AlertPayload(**data))
        assert output_path is not None
        return {"ok": True, "text": text, "path": str(output_path), "filename": output_path.name}
    except VoicevoxError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/audio/{filename}")
def audio(filename: str) -> FileResponse:
    path = cfg.output_dir / Path(filename).name
    if not path.exists():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(str(path), media_type="audio/wav", filename=path.name)


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard() -> str:
    return """
<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>せや TTS テスト / 세야 TTS 테스트</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto;">
  <h1>せや日本語TTSテスト</h1>
  <p style="font-size: 13px;">세야 일본어 TTS 테스트</p>
  <p>VOICEVOX Engineが起動している状態でテストしてください。<br><small>VOICEVOX Engine이 실행 중인 상태에서 테스트하세요.</small></p>
  <label>イベント / 이벤트
    <select id="event_type">
      <option value="follow">follow</option>
      <option value="bits">bits</option>
      <option value="subscribe">subscribe</option>
      <option value="donation">donation</option>
      <option value="test">test</option>
    </select>
  </label><br><br>
  <label>名前 / 이름 <input id="name" value="SeoyaFan"></label><br><br>
  <label>数量 / 수량 <input id="amount" type="number" value="100"></label><br><br>
  <label>メッセージ / 메시지<br><textarea id="message" rows="4" cols="70">今日も配信ありがとう！</textarea></label><br><br>
  <label><input type="checkbox" id="with_sfx" checked> 効果音を付ける / 효과음 붙이기</label><br><br>
  <button onclick="run()">生成して再生 / 생성 후 재생</button>
  <pre id="log"></pre>
  <audio id="player" controls></audio>
<script>
async function run() {
  const body = {
    event_type: document.getElementById('event_type').value,
    name: document.getElementById('name').value,
    amount: Number(document.getElementById('amount').value || 0),
    message: document.getElementById('message').value,
    with_sfx: document.getElementById('with_sfx').checked,
    save_file: true
  };
  const res = await fetch('/alert', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  if (!res.ok) {
    document.getElementById('log').textContent = await res.text();
    return;
  }
  const text = decodeURIComponent(res.headers.get('X-Seoya-Read-Text') || '');
  document.getElementById('log').textContent = '読み上げ文 / 읽은 문장: ' + text;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const player = document.getElementById('player');
  player.src = url;
  player.play();
}
</script>
</body>
</html>
"""
