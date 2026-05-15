import os
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel


app = FastAPI(title="MeloTTS Local Service")

model = None
speaker_ids = {}


def _disable_mps_when_cpu_requested(device):
    if sys.platform != "darwin" or device != "cpu":
        return
    try:
        import torch
    except Exception:
        return
    if hasattr(torch.backends, "mps"):
        torch.backends.mps.is_available = lambda: False


class SpeechRequest(BaseModel):
    input: str
    speed: float = 1.0
    language: str = "ZH"


class ModelRequest(BaseModel):
    model_uid: str = "melotts"


@app.on_event("startup")
async def startup():
    global model, speaker_ids
    try:
        from melo.api import TTS
    except Exception as exc:
        raise RuntimeError(f"无法导入 MeloTTS：{exc}") from exc

    language = os.getenv("MELOTTS_LANGUAGE", "ZH")
    device = os.getenv("MELOTTS_DEVICE", "cpu")
    _disable_mps_when_cpu_requested(device)
    model = TTS(language=language, device=device)
    speaker_ids = dict(model.hps.data.spk2id)


@app.get("/health")
async def health():
    return {
        "ok": model is not None,
        "speaker_ids": speaker_ids,
    }


@app.get("/get_model")
async def get_model(model_uid: str = "melotts"):
    if model_uid != "melotts":
        raise HTTPException(status_code=404, detail="模型未找到")
    return {
        "model_uid": model_uid,
        "model_name": "MeloTTS",
        "description": "MeloTTS 本地文本转语音服务",
        "supported_languages": sorted(speaker_ids.keys()),
        "speaker_ids": speaker_ids,
        "input_format": "text",
        "output_format": "audio/wav",
    }


@app.post("/speech")
async def speech(request: SpeechRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="MeloTTS 模型还没有加载完成")

    text = request.input.strip()
    if len(text) < 1:
        raise HTTPException(status_code=400, detail="缺少需要朗读的文本")

    speaker_key = request.language if request.language in speaker_ids else "ZH"
    if speaker_key not in speaker_ids:
        raise HTTPException(status_code=400, detail=f"无效的语言或 speaker：{request.language}")

    speed = min(1.45, max(0.85, float(request.speed or 1.0)))
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "speech.wav"
        try:
            model.tts_to_file(text[:4000], speaker_ids[speaker_key], str(output_path), speed=speed, quiet=True)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"生成语音失败：{exc}") from exc
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="语音文件没有生成")
        return Response(content=output_path.read_bytes(), media_type="audio/wav")
