import io
import os
import threading
import wave

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

DEFAULT_MODEL = os.getenv("MLX_AUDIO_MODEL", "mlx-community/Kokoro-82M-bf16")
DEFAULT_VOICE = os.getenv("MLX_AUDIO_VOICE", "zf_xiaoxiao")
DEFAULT_SPEED = float(os.getenv("MLX_AUDIO_SPEED", "1.0"))
MAX_TEXT_CHARS = int(os.getenv("MLX_AUDIO_MAX_TEXT_CHARS", "6000"))

app = FastAPI(title="MLX-Audio Kokoro Local Service")
_models = {}
_model_lock = threading.RLock()


class SpeechRequest(BaseModel):
    model: str = DEFAULT_MODEL
    input: str
    voice: str = DEFAULT_VOICE
    speed: float = DEFAULT_SPEED
    response_format: str = "wav"
    lang_code: str | None = None


def _voice_to_lang_code(voice: str) -> str:
    if voice.startswith(("zf_", "zm_")):
        return "z"
    if voice.startswith(("jf_", "jm_")):
        return "j"
    if voice.startswith(("bf_", "bm_")):
        return "b"
    return "a"


def _load_model(model_name: str):
    from mlx_audio.tts.utils import load_model

    with _model_lock:
        if model_name not in _models:
            _models[model_name] = load_model(model_name)
        return _models[model_name]


def _audio_to_wav_bytes(audio, sample_rate: int) -> bytes:
    array = np.asarray(audio, dtype=np.float32)
    if array.ndim > 1:
        array = array.reshape(-1)
    array = np.nan_to_num(array, nan=0.0, posinf=0.0, neginf=0.0)
    array = np.clip(array, -1.0, 1.0)
    pcm = (array * 32767.0).astype(np.int16)
    output = io.BytesIO()
    with wave.open(output, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())
    return output.getvalue()


@app.on_event("startup")
async def startup():
    _load_model(DEFAULT_MODEL)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "model": DEFAULT_MODEL,
        "voice": DEFAULT_VOICE,
        "loaded_models": sorted(_models.keys()),
    }


@app.get("/voices")
async def voices():
    return {
        "model": DEFAULT_MODEL,
        "voices": [
            {"id": "zf_xiaobei", "label": "Kokoro 小北 · 中文女声"},
            {"id": "zf_xiaoni", "label": "Kokoro 小妮 · 中文女声"},
            {"id": "zf_xiaoxiao", "label": "Kokoro 晓晓 · 中文女声"},
            {"id": "zf_xiaoyi", "label": "Kokoro 小艺 · 中文女声"},
            {"id": "zm_yunxi", "label": "Kokoro 云希 · 中文男声"},
            {"id": "zm_yunxia", "label": "Kokoro 云夏 · 中文男声"},
            {"id": "zm_yunyang", "label": "Kokoro 云扬 · 中文男声"},
            {"id": "zm_yunjian", "label": "Kokoro 云健 · 中文男声"},
        ],
    }


@app.get("/v1/models")
async def models():
    return {
        "object": "list",
        "data": [
            {
                "id": DEFAULT_MODEL,
                "object": "model",
                "owned_by": "local-mlx-audio",
            }
        ],
    }


@app.post("/v1/audio/speech")
async def speech(request: SpeechRequest):
    text = (request.input or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="缺少 input 文本")
    model_name = (request.model or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    voice = (request.voice or DEFAULT_VOICE).strip() or DEFAULT_VOICE
    if voice.startswith("mlx_audio:"):
        voice = voice.split(":", 1)[1]
    speed = min(1.6, max(0.7, float(request.speed or DEFAULT_SPEED)))
    lang_code = (request.lang_code or _voice_to_lang_code(voice)).strip()
    model = _load_model(model_name)
    sample_rate = int(getattr(model, "sample_rate", 24000) or 24000)
    chunks = []
    try:
        for result in model.generate(
            text=text[:MAX_TEXT_CHARS],
            voice=voice,
            speed=speed,
            lang_code=lang_code,
        ):
            chunks.append(np.asarray(result.audio, dtype=np.float32))
            if hasattr(result, "sample_rate") and result.sample_rate:
                sample_rate = int(result.sample_rate)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"MLX-Audio 生成失败：{exc}") from exc
    if not chunks:
        raise HTTPException(status_code=500, detail="MLX-Audio 没有返回音频")
    audio = np.concatenate(chunks)
    return Response(
        content=_audio_to_wav_bytes(audio, sample_rate),
        media_type="audio/wav",
        headers={
            "X-TTS-Provider": "mlx_audio",
            "X-TTS-Model": model_name,
            "X-TTS-Voice": voice,
        },
    )
