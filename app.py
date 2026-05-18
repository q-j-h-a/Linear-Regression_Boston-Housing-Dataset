import io
import json
import os
import re
import shlex
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import wave
import asyncio
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path
from threading import RLock

from flask import Flask, render_template, request, jsonify, make_response

from core.context_store import get_context
from core.registry import discover_chart_builders, discover_charts, discover_models, get_model, get_panel
from core.schemas import collect_panel_defaults
from models.simple_linear_regression.model import (
    FEATURE_COLUMNS,
    JSON_ACTIONS,
    load_raw_df,
    student_upload as model_student_upload,
)

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.json.sort_keys = False


JSON_ACTION_HANDLERS = dict(JSON_ACTIONS)
FORM_ACTION_HANDLERS = {"student_upload": model_student_upload}
ASSISTANT_CONFIG_LOCK = RLock()
ASSISTANT_CONFIG_PATH = Path(app.instance_path) / "assistant_settings.json"
ASSISTANT_PROVIDERS = {"ollama_first", "ollama", "external"}
TTS_PROVIDERS = {"edge", "macos", "melotts", "cosyvoice", "mlx_audio", "qwen3_tts"}
DEFAULT_OLLAMA_BASE_URL = os.getenv(
    "THEORY_ASSISTANT_OLLAMA_BASE_URL",
    os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1"),
).rstrip("/")
DEFAULT_OLLAMA_MODEL = os.getenv(
    "THEORY_ASSISTANT_OLLAMA_MODEL",
    os.getenv("OLLAMA_MODEL", "gpt-oss:20b"),
)
DEFAULT_EXTERNAL_BASE_URL = os.getenv(
    "THEORY_ASSISTANT_EXTERNAL_BASE_URL",
    os.getenv("THEORY_ASSISTANT_BASE_URL", "https://api.masterjie.eu.cc/v1"),
).rstrip("/")
DEFAULT_EXTERNAL_MODEL = os.getenv(
    "THEORY_ASSISTANT_EXTERNAL_MODEL",
    os.getenv("THEORY_ASSISTANT_MODEL", "JoyAI-1.3T"),
)


def _env_float(name, default):
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


ASSISTANT_CONFIG = {
    "provider": os.getenv("THEORY_ASSISTANT_PROVIDER", "ollama_first"),
    "ollama_base_url": DEFAULT_OLLAMA_BASE_URL,
    "ollama_model": DEFAULT_OLLAMA_MODEL,
    "external_base_url": DEFAULT_EXTERNAL_BASE_URL,
    "external_model": DEFAULT_EXTERNAL_MODEL,
    "external_api_key": os.getenv("THEORY_ASSISTANT_API_KEY", ""),
    "tts_provider": os.getenv("THEORY_ASSISTANT_TTS_PROVIDER", "edge"),
    "tts_voice": os.getenv("THEORY_ASSISTANT_TTS_VOICE", "zh-CN-XiaoxiaoNeural"),
    "tts_rate": _env_float("THEORY_ASSISTANT_TTS_RATE", 1.15),
    "melotts_service_url": os.getenv(
        "THEORY_ASSISTANT_MELOTTS_SERVICE_URL",
        "http://127.0.0.1:8000/speech",
    ).strip(),
    "melotts_command": os.getenv("THEORY_ASSISTANT_MELOTTS_COMMAND", "melo"),
    "melotts_language": os.getenv("THEORY_ASSISTANT_MELOTTS_LANGUAGE", "ZH"),
    "melotts_speaker": os.getenv("THEORY_ASSISTANT_MELOTTS_SPEAKER", "ZH"),
    "cosyvoice_service_url": os.getenv(
        "THEORY_ASSISTANT_COSYVOICE_SERVICE_URL",
        "http://127.0.0.1:50000/inference_sft",
    ).strip(),
    "cosyvoice_speaker": os.getenv("THEORY_ASSISTANT_COSYVOICE_SPEAKER", "中文女"),
    "cosyvoice_sample_rate": int(_env_float("THEORY_ASSISTANT_COSYVOICE_SAMPLE_RATE", 22050)),
    "mlx_audio_service_url": os.getenv(
        "THEORY_ASSISTANT_MLX_AUDIO_SERVICE_URL",
        "http://127.0.0.1:50010/v1/audio/speech",
    ).strip(),
    "mlx_audio_model": os.getenv("THEORY_ASSISTANT_MLX_AUDIO_MODEL", "mlx-community/Kokoro-82M-bf16"),
    "mlx_audio_voice": os.getenv("THEORY_ASSISTANT_MLX_AUDIO_VOICE", "zf_xiaoxiao"),
    "qwen3_tts_service_url": os.getenv(
        "THEORY_ASSISTANT_QWEN3_TTS_SERVICE_URL",
        "http://127.0.0.1:50010/v1/audio/speech",
    ).strip(),
    "qwen3_tts_model": os.getenv(
        "THEORY_ASSISTANT_QWEN3_TTS_MODEL",
        ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit",
    ),
    "qwen3_tts_voice": os.getenv("THEORY_ASSISTANT_QWEN3_TTS_VOICE", "vivian"),
    "qwen3_tts_language": os.getenv("THEORY_ASSISTANT_QWEN3_TTS_LANGUAGE", "chinese"),
}
LOCAL_TTS_VOICES = {
    "Tingting": "婷婷",
    "Meijia": "美佳",
    "Sinji": "善怡",
    "Flo (中文（中国大陆）)": "Flo",
    "Shelley (中文（中国大陆）)": "Shelley",
    "Sandy (中文（中国大陆）)": "Sandy",
    "Eddy (中文（中国大陆）)": "Eddy",
}
EDGE_TTS_VOICES = {
    "zh-CN-XiaoxiaoNeural": "晓晓",
    "zh-CN-XiaoyiNeural": "小艺",
    "zh-CN-YunxiNeural": "云希",
    "zh-CN-YunjianNeural": "云健",
    "zh-CN-YunxiaNeural": "云夏",
    "zh-CN-YunyangNeural": "云扬",
}
MELOTTS_VOICES = {
    "melotts:ZH": "MeloTTS 中文",
}
COSYVOICE_VOICES = {
    "cosyvoice:中文女": "CosyVoice 中文女",
    "cosyvoice:中文男": "CosyVoice 中文男",
    "cosyvoice:粤语女": "CosyVoice 粤语女",
    "cosyvoice:英文女": "CosyVoice 英文女",
    "cosyvoice:英文男": "CosyVoice 英文男",
}
MLX_AUDIO_VOICES = {
    "mlx_audio:zf_xiaobei": "Kokoro 小北 · 中文女声",
    "mlx_audio:zf_xiaoni": "Kokoro 小妮 · 中文女声",
    "mlx_audio:zf_xiaoxiao": "Kokoro 晓晓 · 中文女声",
    "mlx_audio:zf_xiaoyi": "Kokoro 小艺 · 中文女声",
    "mlx_audio:zm_yunxi": "Kokoro 云希 · 中文男声",
    "mlx_audio:zm_yunxia": "Kokoro 云夏 · 中文男声",
    "mlx_audio:zm_yunyang": "Kokoro 云扬 · 中文男声",
    "mlx_audio:zm_yunjian": "Kokoro 云健 · 中文男声",
}
QWEN3_TTS_VOICES = {
    "qwen3_tts:vivian": "Qwen3 Vivian · 中文女声",
    "qwen3_tts:serena": "Qwen3 Serena · 中文女声",
    "qwen3_tts:uncle_fu": "Qwen3 Uncle Fu · 中文男声",
    "qwen3_tts:dylan": "Qwen3 Dylan · 北京男声",
    "qwen3_tts:eric": "Qwen3 Eric · 成都男声",
    "qwen3_tts:ryan": "Qwen3 Ryan · 英文男声",
    "qwen3_tts:aiden": "Qwen3 Aiden · 英文男声",
    "qwen3_tts:ono_anna": "Qwen3 Ono Anna · 日文女声",
    "qwen3_tts:sohee": "Qwen3 Sohee · 韩文女声",
}
THEORY_PAGE_TITLES = {
    "basic": "实验基本信息",
    "purpose": "实验目的",
    "knowledge": "前置知识",
    "model": "模型介绍",
    "dataset": "数据集",
    "criterion": "学习准则",
    "optimization": "参数优化",
    "evaluation": "评价指标",
    "result": "预期成果",
    "thinking": "思考拓展",
}


def _load_saved_assistant_config():
    if not ASSISTANT_CONFIG_PATH.exists():
        return
    try:
        data = json.loads(ASSISTANT_CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return
    allowed_keys = {
        "provider",
        "ollama_base_url",
        "ollama_model",
        "external_base_url",
        "external_model",
        "tts_provider",
        "tts_voice",
        "tts_rate",
        "melotts_service_url",
        "melotts_command",
        "melotts_language",
        "melotts_speaker",
        "cosyvoice_service_url",
        "cosyvoice_speaker",
        "cosyvoice_sample_rate",
        "mlx_audio_service_url",
        "mlx_audio_model",
        "mlx_audio_voice",
        "qwen3_tts_service_url",
        "qwen3_tts_model",
        "qwen3_tts_voice",
        "qwen3_tts_language",
    }
    with ASSISTANT_CONFIG_LOCK:
        for key in allowed_keys:
            if key == "tts_rate":
                try:
                    ASSISTANT_CONFIG[key] = min(1.45, max(0.85, float(data.get(key))))
                except (TypeError, ValueError):
                    pass
                continue
            if key == "cosyvoice_sample_rate":
                try:
                    ASSISTANT_CONFIG[key] = int(float(data.get(key)))
                except (TypeError, ValueError):
                    pass
                continue
            value = str(data.get(key) or "").strip()
            if not value and key not in {"melotts_speaker", "cosyvoice_speaker"}:
                continue
            if key == "provider" and value not in ASSISTANT_PROVIDERS:
                continue
            if key == "tts_provider" and value not in TTS_PROVIDERS:
                continue
            ASSISTANT_CONFIG[key] = value.rstrip("/") if key.endswith("_base_url") else value


def _save_assistant_config():
    with ASSISTANT_CONFIG_LOCK:
        data = {
            "provider": ASSISTANT_CONFIG["provider"],
            "ollama_base_url": ASSISTANT_CONFIG["ollama_base_url"],
            "ollama_model": ASSISTANT_CONFIG["ollama_model"],
            "external_base_url": ASSISTANT_CONFIG["external_base_url"],
            "external_model": ASSISTANT_CONFIG["external_model"],
            "tts_provider": ASSISTANT_CONFIG["tts_provider"],
            "tts_voice": ASSISTANT_CONFIG["tts_voice"],
            "tts_rate": ASSISTANT_CONFIG["tts_rate"],
            "melotts_service_url": ASSISTANT_CONFIG["melotts_service_url"],
            "melotts_command": ASSISTANT_CONFIG["melotts_command"],
            "melotts_language": ASSISTANT_CONFIG["melotts_language"],
            "melotts_speaker": ASSISTANT_CONFIG["melotts_speaker"],
            "cosyvoice_service_url": ASSISTANT_CONFIG["cosyvoice_service_url"],
            "cosyvoice_speaker": ASSISTANT_CONFIG["cosyvoice_speaker"],
            "cosyvoice_sample_rate": ASSISTANT_CONFIG["cosyvoice_sample_rate"],
            "mlx_audio_service_url": ASSISTANT_CONFIG["mlx_audio_service_url"],
            "mlx_audio_model": ASSISTANT_CONFIG["mlx_audio_model"],
            "mlx_audio_voice": ASSISTANT_CONFIG["mlx_audio_voice"],
            "qwen3_tts_service_url": ASSISTANT_CONFIG["qwen3_tts_service_url"],
            "qwen3_tts_model": ASSISTANT_CONFIG["qwen3_tts_model"],
            "qwen3_tts_voice": ASSISTANT_CONFIG["qwen3_tts_voice"],
            "qwen3_tts_language": ASSISTANT_CONFIG["qwen3_tts_language"],
        }
    ASSISTANT_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    ASSISTANT_CONFIG_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _assistant_config_snapshot():
    with ASSISTANT_CONFIG_LOCK:
        return dict(ASSISTANT_CONFIG)


def _public_assistant_config():
    config = _assistant_config_snapshot()
    provider = config["provider"] if config.get("provider") in ASSISTANT_PROVIDERS else "ollama_first"
    return {
        "provider": provider,
        "ollama": {
            "base_url": config["ollama_base_url"],
            "model": config["ollama_model"],
        },
        "external": {
            "base_url": config["external_base_url"],
            "model": config["external_model"],
            "api_key_configured": bool(config.get("external_api_key")),
        },
        "tts": {
            "provider": config.get("tts_provider") if config.get("tts_provider") in TTS_PROVIDERS else "edge",
            "default_voice": config.get("tts_voice") or "zh-CN-XiaoxiaoNeural",
            "default_rate": config.get("tts_rate") or 1.15,
            "edge_voices": EDGE_TTS_VOICES,
            "local_voices": LOCAL_TTS_VOICES,
            "melotts_voices": MELOTTS_VOICES,
            "cosyvoice_voices": COSYVOICE_VOICES,
            "mlx_audio_voices": MLX_AUDIO_VOICES,
            "qwen3_tts_voices": QWEN3_TTS_VOICES,
            "melotts": {
                "service_url": config.get("melotts_service_url") or "",
                "command": config.get("melotts_command") or "melo",
                "language": config.get("melotts_language") or "ZH",
                "speaker": config.get("melotts_speaker") or "ZH",
            },
            "cosyvoice": {
                "service_url": config.get("cosyvoice_service_url") or "",
                "speaker": config.get("cosyvoice_speaker") or "中文女",
                "sample_rate": config.get("cosyvoice_sample_rate") or 22050,
            },
            "mlx_audio": {
                "service_url": config.get("mlx_audio_service_url") or "",
                "model": config.get("mlx_audio_model") or "mlx-community/Kokoro-82M-bf16",
                "voice": config.get("mlx_audio_voice") or "zf_xiaoxiao",
            },
            "qwen3_tts": {
                "service_url": config.get("qwen3_tts_service_url") or "",
                "model": config.get("qwen3_tts_model") or ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit",
                "voice": config.get("qwen3_tts_voice") or "vivian",
                "language": config.get("qwen3_tts_language") or "chinese",
            },
        },
    }


def _update_assistant_config(payload):
    provider = str(payload.get("provider") or "").strip()
    if provider not in ASSISTANT_PROVIDERS:
        raise ValueError("模型模式无效")

    next_config = {
        "provider": provider,
        "ollama_base_url": str(payload.get("ollama_base_url") or "").strip().rstrip("/"),
        "ollama_model": str(payload.get("ollama_model") or "").strip(),
        "external_base_url": str(payload.get("external_base_url") or "").strip().rstrip("/"),
        "external_model": str(payload.get("external_model") or "").strip(),
    }
    tts_provider = str(payload.get("tts_provider") or ASSISTANT_CONFIG.get("tts_provider") or "edge").strip()
    if tts_provider not in TTS_PROVIDERS:
        raise ValueError("语音引擎无效")
    try:
        tts_rate = float(payload.get("tts_rate") if "tts_rate" in payload else ASSISTANT_CONFIG.get("tts_rate", 1.15))
    except (TypeError, ValueError):
        raise ValueError("语速配置无效")
    tts_rate = min(1.45, max(0.85, tts_rate))
    tts_voice = str(payload.get("tts_voice") or ASSISTANT_CONFIG.get("tts_voice") or "zh-CN-XiaoxiaoNeural").strip()
    melotts_service_url = str(payload.get("melotts_service_url") if "melotts_service_url" in payload else ASSISTANT_CONFIG.get("melotts_service_url", "")).strip()
    melotts_command = str(payload.get("melotts_command") or ASSISTANT_CONFIG.get("melotts_command") or "melo").strip()
    melotts_language = str(payload.get("melotts_language") or ASSISTANT_CONFIG.get("melotts_language") or "ZH").strip()
    melotts_speaker = str(payload.get("melotts_speaker") if "melotts_speaker" in payload else ASSISTANT_CONFIG.get("melotts_speaker", "ZH")).strip()
    cosyvoice_service_url = str(payload.get("cosyvoice_service_url") if "cosyvoice_service_url" in payload else ASSISTANT_CONFIG.get("cosyvoice_service_url", "")).strip()
    cosyvoice_speaker = str(payload.get("cosyvoice_speaker") if "cosyvoice_speaker" in payload else ASSISTANT_CONFIG.get("cosyvoice_speaker", "中文女")).strip()
    mlx_audio_service_url = str(payload.get("mlx_audio_service_url") if "mlx_audio_service_url" in payload else ASSISTANT_CONFIG.get("mlx_audio_service_url", "")).strip()
    mlx_audio_model = str(payload.get("mlx_audio_model") or ASSISTANT_CONFIG.get("mlx_audio_model") or "mlx-community/Kokoro-82M-bf16").strip()
    mlx_audio_voice = str(payload.get("mlx_audio_voice") or ASSISTANT_CONFIG.get("mlx_audio_voice") or "zf_xiaoxiao").strip()
    qwen3_tts_service_url = str(payload.get("qwen3_tts_service_url") if "qwen3_tts_service_url" in payload else ASSISTANT_CONFIG.get("qwen3_tts_service_url", "")).strip()
    qwen3_tts_model = str(payload.get("qwen3_tts_model") or ASSISTANT_CONFIG.get("qwen3_tts_model") or ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit").strip()
    qwen3_tts_voice = str(payload.get("qwen3_tts_voice") or ASSISTANT_CONFIG.get("qwen3_tts_voice") or "vivian").strip()
    qwen3_tts_language = str(payload.get("qwen3_tts_language") or ASSISTANT_CONFIG.get("qwen3_tts_language") or "chinese").strip()
    try:
        cosyvoice_sample_rate = int(float(payload.get("cosyvoice_sample_rate") if "cosyvoice_sample_rate" in payload else ASSISTANT_CONFIG.get("cosyvoice_sample_rate", 22050)))
    except (TypeError, ValueError):
        raise ValueError("CosyVoice 采样率配置无效")
    if not tts_voice:
        raise ValueError("缺少音色配置")
    if tts_provider == "melotts" and not melotts_service_url and not melotts_command:
        raise ValueError("缺少 MeloTTS 服务地址或本机命令")
    if tts_provider == "cosyvoice" and not cosyvoice_service_url:
        raise ValueError("缺少 CosyVoice 服务地址")
    if tts_provider == "mlx_audio" and not mlx_audio_service_url:
        raise ValueError("缺少 MLX-Audio 服务地址")
    if tts_provider == "mlx_audio" and not mlx_audio_model:
        raise ValueError("缺少 MLX-Audio 模型名")
    if tts_provider == "qwen3_tts" and not qwen3_tts_service_url:
        raise ValueError("缺少 Qwen3-TTS 服务地址")
    if tts_provider == "qwen3_tts" and not qwen3_tts_model:
        raise ValueError("缺少 Qwen3-TTS 模型名")
    next_config.update({
        "tts_provider": tts_provider,
        "tts_voice": tts_voice,
        "tts_rate": tts_rate,
        "melotts_service_url": melotts_service_url,
        "melotts_command": melotts_command,
        "melotts_language": melotts_language or "ZH",
        "melotts_speaker": melotts_speaker or "ZH",
        "cosyvoice_service_url": cosyvoice_service_url,
        "cosyvoice_speaker": cosyvoice_speaker or "中文女",
        "cosyvoice_sample_rate": cosyvoice_sample_rate or 22050,
        "mlx_audio_service_url": mlx_audio_service_url,
        "mlx_audio_model": mlx_audio_model,
        "mlx_audio_voice": mlx_audio_voice or "zf_xiaoxiao",
        "qwen3_tts_service_url": qwen3_tts_service_url,
        "qwen3_tts_model": qwen3_tts_model,
        "qwen3_tts_voice": qwen3_tts_voice or "vivian",
        "qwen3_tts_language": qwen3_tts_language or "chinese",
    })
    if not next_config["ollama_base_url"]:
        raise ValueError("缺少 Ollama 接口地址")
    if not next_config["ollama_model"]:
        raise ValueError("缺少 Ollama 模型名")
    if provider in {"external", "ollama_first"} and not next_config["external_base_url"]:
        raise ValueError("缺少外部 API 接口地址")
    if provider in {"external", "ollama_first"} and not next_config["external_model"]:
        raise ValueError("缺少外部 API 模型名")

    with ASSISTANT_CONFIG_LOCK:
        ASSISTANT_CONFIG.update(next_config)
        if payload.get("clear_external_api_key"):
            ASSISTANT_CONFIG["external_api_key"] = ""
        elif "external_api_key" in payload:
            api_key = str(payload.get("external_api_key") or "").strip()
            if api_key:
                ASSISTANT_CONFIG["external_api_key"] = api_key
    _save_assistant_config()
    return _public_assistant_config()


_load_saved_assistant_config()


class _TheoryHtmlTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._skip_depth = 0
        self._parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth:
            return
        text = data.strip()
        if text:
            self._parts.append(text)

    def text(self):
        return re.sub(r"\s+", " ", " ".join(self._parts)).strip()


def _json_action_response(handler, payload):
    try:
        return jsonify(handler(payload))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def _student_upload_response(file, source_type):
    try:
        return jsonify(model_student_upload(file, source_type))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def _build_theory_explain_prompt(title, text):
    clipped_text = text[:7000]
    return (
        "请基于下面这页线性回归教学内容，生成一段适合学生听的中文讲解稿。\n"
        "要求：\n"
        "1. 只讲页面正文明确出现的信息，不补充正文里没有出现的字段、数据、公式或案例。\n"
        "2. 像老师口头讲课一样自然，先讲这页在整个实验里的作用，再解释关键概念。\n"
        "3. 不要使用 Markdown 标题、表格和项目符号。\n"
        "4. 控制在 260 到 450 字之间，适合朗读。\n\n"
        f"页面标题：{title}\n\n"
        f"页面正文：\n{clipped_text}"
    )


@lru_cache(maxsize=1)
def _load_theory_page_library():
    theory_dir = Path(app.root_path) / "static" / "theory-html"
    pages = []
    for page_id, title in THEORY_PAGE_TITLES.items():
        path = theory_dir / f"{page_id}.html"
        if not path.exists():
            continue
        extractor = _TheoryHtmlTextExtractor()
        extractor.feed(path.read_text(encoding="utf-8", errors="ignore"))
        text = extractor.text()
        if len(text) < 20:
            continue
        display_title = "实验基本信息（实验基础信息）" if page_id == "basic" else title
        pages.append({
            "id": page_id,
            "title": display_title,
            "text": text[:1400],
        })
    return pages


def _clean_theory_chat_history(history):
    cleaned = []
    if not isinstance(history, list):
        return cleaned
    for item in history[-12:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        if role not in {"user", "assistant"}:
            continue
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        cleaned.append({
            "role": role,
            "content": content[:900],
            "title": str(item.get("title") or "").strip()[:80],
        })
    return cleaned


def _build_theory_page_context(pages, current_title):
    by_title = {}
    current_title = str(current_title or "").strip()
    for item in _load_theory_page_library():
        if current_title and item["title"].startswith(current_title):
            continue
        by_title[item["title"]] = item
    if not isinstance(pages, list):
        return list(by_title.values())
    for item in pages[-8:]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()[:80] or "未命名理论页"
        text = str(item.get("text") or "").strip()
        if title == current_title or len(text) < 20:
            continue
        by_title[title] = {
            "title": title,
            "text": text[:1400],
        }
    return list(by_title.values())


def _build_theory_chat_prompt(title, text, question, history, pages):
    clipped_text = text[:6500]
    clipped_question = question[:800]
    history_lines = []
    for item in history:
        speaker = "参训学员" if item["role"] == "user" else "AI助教"
        page_title = f"（页面：{item['title']}）" if item.get("title") else ""
        history_lines.append(f"{speaker}{page_title}：{item['content']}")
    history_text = "\n".join(history_lines) if history_lines else "无"
    page_blocks = [f"【{item['title']}】\n{item['text']}" for item in pages]
    pages_text = "\n\n".join(page_blocks) if page_blocks else "无"
    return (
        "请基于当前理论页、理论页资料库和历史对话回答学生问题。\n"
        "要求：\n"
        "1. 只使用下面给出的理论页资料和历史对话，不补充资料里没有出现的字段、数据、公式或案例。\n"
        "2. 学生问到其他理论页时，必须先在理论页资料库里查找，不要只按当前页判断。\n"
        "3. 参考历史对话理解代词、追问和上下文，但不能让历史对话覆盖页面资料。\n"
        "4. 学生口语里说的“实验基础信息”通常指“实验基本信息”。\n"
        "5. 如果问题超出当前页和理论页资料库，请直接说明这些资料没有说明这点。\n"
        "6. 回答要适合语音朗读，控制在 120 到 260 字之间。\n"
        "7. 不要使用 Markdown 标题、表格和项目符号。\n\n"
        f"当前页面标题：{title}\n\n"
        f"当前页面正文：\n{clipped_text}\n\n"
        f"理论页资料库：\n{pages_text}\n\n"
        f"历史对话：\n{history_text}\n\n"
        f"学生问题：{clipped_question}"
    )


def _extract_chat_content(data):
    try:
        message = data["choices"][0]["message"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("AI 接口返回格式异常") from exc
    content = str(message.get("content") or "").strip()
    if content:
        return content
    raise RuntimeError("AI 接口没有返回最终回答")


def _request_openai_compatible(base_url, model, messages, max_tokens, api_key=""):
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "LinearRegressionTeachingLab/1.0",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return _extract_chat_content(data)


def _request_chat_completion(messages, max_tokens):
    config = _assistant_config_snapshot()
    provider = config.get("provider") if config.get("provider") in ASSISTANT_PROVIDERS else "ollama_first"
    errors = []

    if provider in {"ollama_first", "ollama"}:
        try:
            return {
                "content": _request_openai_compatible(
                    config["ollama_base_url"],
                    config["ollama_model"],
                    messages,
                    max_tokens * 2,
                ),
                "model": config["ollama_model"],
                "provider": "ollama",
            }
        except Exception as exc:
            if provider == "ollama":
                raise RuntimeError(f"本地 Ollama 请求失败：{exc}") from exc
            errors.append(f"本地 Ollama：{exc}")

    if provider in {"ollama_first", "external"}:
        api_key = config.get("external_api_key") or ""
        if not api_key:
            errors.append("外部 API：未配置 API key")
        else:
            try:
                return {
                    "content": _request_openai_compatible(
                        config["external_base_url"],
                        config["external_model"],
                        messages,
                        max_tokens,
                        api_key=api_key,
                    ),
                    "model": config["external_model"],
                    "provider": "external",
                }
            except Exception as exc:
                if provider == "external":
                    raise RuntimeError(f"外部 API 请求失败：{exc}") from exc
                errors.append(f"外部 API：{exc}")

    raise RuntimeError("；".join(errors) or "没有可用的 AI 模型配置")


def _request_theory_explanation(title, text):
    result = _request_chat_completion(
        [
            {
                "role": "system",
                "content": "你是一个中文机器学习实验课助教，擅长把线性回归理论讲得清楚、自然、适合朗读。",
            },
            {"role": "user", "content": _build_theory_explain_prompt(title, text)},
        ],
        max_tokens=480,
    )
    return result


def _request_theory_answer(title, text, question, history=None, pages=None):
    cleaned_history = _clean_theory_chat_history(history)
    cleaned_pages = _build_theory_page_context(pages, title)
    result = _request_chat_completion(
        [
            {
                "role": "system",
                "content": "你是一个中文机器学习实验课助教，只根据已提供的理论页资料和历史对话回答学生问题。",
            },
            {"role": "user", "content": _build_theory_chat_prompt(title, text, question, cleaned_history, cleaned_pages)},
        ],
        max_tokens=320,
    )
    return result


def _local_tts_audio(text, voice, rate):
    selected_voice = voice if voice in LOCAL_TTS_VOICES else "Tingting"
    selected_rate = int(min(260, max(140, rate)))
    clipped_text = text[:6000]
    with tempfile.TemporaryDirectory() as tmpdir:
        text_path = os.path.join(tmpdir, "speech.txt")
        aiff_path = os.path.join(tmpdir, "speech.aiff")
        m4a_path = os.path.join(tmpdir, "speech.m4a")
        with open(text_path, "w", encoding="utf-8") as file:
            file.write(clipped_text)
        subprocess.run(
            ["say", "-v", selected_voice, "-r", str(selected_rate), "-f", text_path, "-o", aiff_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=90,
        )
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", aiff_path, m4a_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=60,
        )
        with open(m4a_path, "rb") as file:
            return file.read()


async def _save_edge_tts_audio(text, voice, rate_percent, output_path):
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, rate=f"{rate_percent:+d}%")
    await communicate.save(output_path)


def _edge_tts_audio(text, voice, rate):
    selected_voice = voice if voice in EDGE_TTS_VOICES else "zh-CN-XiaoxiaoNeural"
    selected_rate = int(min(35, max(-15, round((rate - 1) * 100))))
    clipped_text = text[:6000]
    with tempfile.TemporaryDirectory() as tmpdir:
        mp3_path = os.path.join(tmpdir, "speech.mp3")
        asyncio.run(_save_edge_tts_audio(clipped_text, selected_voice, selected_rate, mp3_path))
        with open(mp3_path, "rb") as file:
            return file.read()


def _melotts_service_audio(text, rate, config):
    service_url = str(config.get("melotts_service_url") or "").strip()
    language = str(config.get("melotts_language") or "ZH").strip() or "ZH"
    speaker = str(config.get("melotts_speaker") or "ZH").strip() or "ZH"
    clipped_text = text[:4000]
    if "/speech" in service_url:
        payload = {
            "input": clipped_text,
            "speed": rate,
            "language": language,
        }
    else:
        payload = {
            "text": clipped_text,
            "speed": rate,
            "language": language,
            "speaker_id": speaker,
            "format": "mp3",
        }
    req = urllib.request.Request(
        service_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "LinearRegressionTeachingLab/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        content_type = resp.headers.get("Content-Type") or "audio/wav"
        return resp.read(), content_type.split(";")[0]


def _melotts_cli_audio(text, rate, config):
    command = shlex.split(config.get("melotts_command") or "melo")
    if not command:
        command = ["melo"]
    language = str(config.get("melotts_language") or "ZH").strip() or "ZH"
    speaker = str(config.get("melotts_speaker") or "").strip()
    clipped_text = text[:4000]
    with tempfile.TemporaryDirectory() as tmpdir:
        text_path = os.path.join(tmpdir, "speech.txt")
        wav_path = os.path.join(tmpdir, "speech.wav")
        with open(text_path, "w", encoding="utf-8") as file:
            file.write(clipped_text)
        args = [
            *command,
            text_path,
            wav_path,
            "--file",
            "-l",
            language,
            "--speed",
            f"{rate:.2f}",
        ]
        if speaker:
            args.extend(["--speaker", speaker])
        subprocess.run(
            args,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=180,
        )
        with open(wav_path, "rb") as file:
            return file.read()


def _melotts_tts_audio(text, rate, config):
    service_url = str(config.get("melotts_service_url") or "").strip()
    if service_url:
        return _melotts_service_audio(text, rate, config)
    return _melotts_cli_audio(text, rate, config), "audio/wav"


def _pcm16_to_wav_bytes(pcm_bytes, sample_rate, channels=1):
    output = io.BytesIO()
    with wave.open(output, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return output.getvalue()


def _cosyvoice_tts_audio(text, rate, config):
    service_url = str(config.get("cosyvoice_service_url") or "").strip()
    speaker = str(config.get("cosyvoice_speaker") or "中文女").strip() or "中文女"
    try:
        sample_rate = int(config.get("cosyvoice_sample_rate") or 22050)
    except (TypeError, ValueError):
        sample_rate = 22050
    sample_rate = min(48000, max(8000, sample_rate))
    clipped_text = text[:4000]
    payload = urllib.parse.urlencode({
        "tts_text": clipped_text,
        "spk_id": speaker,
    }).encode("utf-8")
    req = urllib.request.Request(
        service_url,
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "LinearRegressionTeachingLab/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=240) as resp:
        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip()
        audio = resp.read()
    if content_type in {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4"}:
        return audio, content_type
    return _pcm16_to_wav_bytes(audio, sample_rate), "audio/wav"


def _mlx_audio_tts_audio(text, voice, rate, config):
    service_url = str(config.get("mlx_audio_service_url") or "").strip()
    model = str(config.get("mlx_audio_model") or "mlx-community/Kokoro-82M-bf16").strip()
    selected_voice = str(voice or config.get("mlx_audio_voice") or "mlx_audio:zf_xiaoxiao").strip()
    if selected_voice.startswith("mlx_audio:"):
        selected_voice = selected_voice.split(":", 1)[1]
    if not selected_voice:
        selected_voice = str(config.get("mlx_audio_voice") or "zf_xiaoxiao").strip() or "zf_xiaoxiao"
    clipped_text = text[:6000]
    payload = {
        "model": model,
        "input": clipped_text,
        "voice": selected_voice,
        "speed": rate,
        "response_format": "wav",
    }
    req = urllib.request.Request(
        service_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "LinearRegressionTeachingLab/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        content_type = (resp.headers.get("Content-Type") or "audio/wav").split(";")[0].strip()
        audio = resp.read()
    if content_type in {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4"}:
        return audio, content_type
    return audio, "audio/wav"


def _qwen3_tts_audio(text, voice, rate, config):
    service_url = str(config.get("qwen3_tts_service_url") or "").strip()
    model = str(config.get("qwen3_tts_model") or ".qwen3-tts/mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-4bit").strip()
    selected_voice = str(voice or config.get("qwen3_tts_voice") or "qwen3_tts:vivian").strip()
    if selected_voice.startswith("qwen3_tts:"):
        selected_voice = selected_voice.split(":", 1)[1]
    if not selected_voice:
        selected_voice = str(config.get("qwen3_tts_voice") or "vivian").strip() or "vivian"
    language = str(config.get("qwen3_tts_language") or "chinese").strip() or "chinese"
    clipped_text = text[:6000]
    payload = {
        "model": model,
        "input": clipped_text,
        "voice": selected_voice,
        "speed": rate,
        "language": language,
        "response_format": "wav",
        "max_tokens": 8192,
    }
    req = urllib.request.Request(
        service_url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "LinearRegressionTeachingLab/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        content_type = (resp.headers.get("Content-Type") or "audio/wav").split(";")[0].strip()
        audio = resp.read()
    if content_type in {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4"}:
        return audio, content_type
    return audio, "audio/wav"


def _tts_audio(text, voice, rate, provider=None):
    config = _assistant_config_snapshot()
    selected_provider = str(provider or config.get("tts_provider") or "edge").strip()
    if selected_provider not in TTS_PROVIDERS:
        selected_provider = "edge"
    selected_voice = voice or config.get("tts_voice") or "zh-CN-XiaoxiaoNeural"
    if selected_provider == "edge":
        return _edge_tts_audio(text, selected_voice, rate), "audio/mpeg", "edge"
    if selected_provider == "macos":
        return _local_tts_audio(text, selected_voice, 180 * rate), "audio/mp4", "macos"
    if selected_provider == "cosyvoice":
        audio, content_type = _cosyvoice_tts_audio(text, rate, config)
        return audio, content_type, "cosyvoice"
    if selected_provider == "mlx_audio":
        audio, content_type = _mlx_audio_tts_audio(text, selected_voice, rate, config)
        return audio, content_type, "mlx_audio"
    if selected_provider == "qwen3_tts":
        audio, content_type = _qwen3_tts_audio(text, selected_voice, rate, config)
        return audio, content_type, "qwen3_tts"
    audio, content_type = _melotts_tts_audio(text, rate, config)
    return audio, content_type, "melotts"


@app.route("/")
def index():
    load_raw_df()
    return render_template(
        "index.html",
        feature_names=FEATURE_COLUMNS,
        default_feature="RM",
    )


@app.route("/api/theory_explain", methods=["POST"])
def api_theory_explain():
    body = request.get_json() or {}
    title = str(body.get("title") or "当前理论页").strip()
    text = str(body.get("text") or "").strip()
    if len(text) < 20:
        return jsonify({"error": "当前页面文本太少，无法生成讲解。"}), 400
    try:
        result = _request_theory_explanation(title, text)
        return jsonify({
            "model": result["model"],
            "provider": result["provider"],
            "explanation": result["content"],
        })
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return jsonify({"error": f"AI 接口请求失败：HTTP {exc.code} {detail}"}), 502
    except Exception as exc:
        return jsonify({"error": f"AI 讲解生成失败：{exc}"}), 500


@app.route("/api/theory_chat", methods=["POST"])
def api_theory_chat():
    body = request.get_json() or {}
    title = str(body.get("title") or "当前理论页").strip()
    text = str(body.get("text") or "").strip()
    question = str(body.get("question") or "").strip()
    history = body.get("history")
    pages = body.get("pages")
    if len(text) < 20:
        return jsonify({"error": "当前页面文本太少，无法回答问题。"}), 400
    if len(question) < 2:
        return jsonify({"error": "请输入要提问的内容。"}), 400
    try:
        result = _request_theory_answer(title, text, question, history, pages)
        return jsonify({
            "model": result["model"],
            "provider": result["provider"],
            "answer": result["content"],
        })
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return jsonify({"error": f"AI 接口请求失败：HTTP {exc.code} {detail}"}), 502
    except Exception as exc:
        return jsonify({"error": f"AI 问答失败：{exc}"}), 500


@app.route("/api/assistant_config", methods=["GET"])
def api_assistant_config():
    return jsonify(_public_assistant_config())


@app.route("/api/assistant_config", methods=["POST"])
def api_update_assistant_config():
    body = request.get_json() or {}
    try:
        return jsonify(_update_assistant_config(body))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except OSError as exc:
        return jsonify({"error": f"保存设置失败：{exc}"}), 500


@app.route("/api/assistant_models", methods=["GET"])
def api_assistant_models():
    config = _assistant_config_snapshot()
    base_url = str(request.args.get("base_url") or config["ollama_base_url"]).strip().rstrip("/")
    if not base_url:
        return jsonify({"error": "缺少接口地址"}), 400
    req = urllib.request.Request(
        f"{base_url}/models",
        headers={"User-Agent": "LinearRegressionTeachingLab/1.0"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        models = []
        for item in data.get("data", []):
            model_id = str(item.get("id") or "").strip()
            if model_id:
                models.append(model_id)
        return jsonify({"base_url": base_url, "models": models})
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return jsonify({"error": f"模型列表请求失败：HTTP {exc.code} {detail}"}), 502
    except Exception as exc:
        return jsonify({"error": f"模型列表请求失败：{exc}"}), 502


@app.route("/api/assistant_test", methods=["POST"])
def api_assistant_test():
    body = request.get_json() or {}
    question = str(body.get("question") or "请用一句话介绍你当前使用的模型来源。").strip()
    if len(question) < 2:
        return jsonify({"error": "测试问题太短。"}), 400
    started = time.perf_counter()
    try:
        result = _request_chat_completion(
            [
                {
                    "role": "system",
                    "content": "你是机器学习实验课的中文 AI 助教。回答要短，适合演示，不能使用 Markdown。",
                },
                {"role": "user", "content": question[:300]},
            ],
            max_tokens=120,
        )
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return jsonify({
            "provider": result["provider"],
            "model": result["model"],
            "answer": result["content"],
            "elapsed_ms": elapsed_ms,
        })
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"模型测试失败：{exc}"}), 500


@app.route("/api/tts", methods=["POST"])
@app.route("/api/local_tts", methods=["POST"])
def api_tts():
    body = request.get_json() or {}
    text = str(body.get("text") or "").strip()
    voice = str(body.get("voice") or "zh-CN-XiaoxiaoNeural").strip()
    provider = str(body.get("provider") or "").strip()
    try:
        rate = float(body.get("rate") or 1.12)
    except (TypeError, ValueError):
        rate = 1.12
    rate = min(1.45, max(0.85, rate))
    if len(text) < 2:
        return jsonify({"error": "缺少需要朗读的文本。"}), 400
    try:
        audio, content_type, used_provider = _tts_audio(text, voice, rate, provider if provider else None)
        resp = make_response(audio)
        resp.headers["Content-Type"] = content_type
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["X-TTS-Provider"] = used_provider
        return resp
    except FileNotFoundError:
        return jsonify({"error": "当前系统缺少语音生成命令，请在设置页检查本地语音命令，或改用 Edge TTS / macOS 语音。"}), 500
    except ImportError:
        return jsonify({"error": "当前环境缺少 edge-tts，请先安装依赖。"}), 500
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or b"").decode("utf-8", errors="replace")[:200]
        return jsonify({"error": f"本机语音生成失败：{detail or exc}"}), 500
    except subprocess.TimeoutExpired:
        return jsonify({"error": "本机语音生成超时，文本可能太长。"}), 504
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:200]
        return jsonify({"error": f"本地语音服务请求失败：HTTP {exc.code} {detail}"}), 502
    except urllib.error.URLError as exc:
        return jsonify({"error": f"本地语音服务没有启动，或服务地址不可访问：{exc.reason}"}), 503
    except Exception as exc:
        return jsonify({"error": f"语音生成失败：{exc}"}), 500


@app.route("/api/chart_registry", methods=["GET"])
def api_chart_registry():
    page = request.args.get("page")
    model = request.args.get("model")
    try:
        if model and get_model(model) is None:
            return jsonify({"error": f"Unknown model: {model}"}), 404
        return jsonify({
            "model": model or "simple_linear_regression",
            "charts": discover_charts(page, model=model),
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/page_schema", methods=["GET"])
def api_page_schema():
    page = request.args.get("page", "train_eval")
    model = request.args.get("model")
    try:
        model_meta = get_model(model)
        if model_meta is None:
            return jsonify({"error": f"Unknown model: {model or 'simple_linear_regression'}"}), 404

        panel = get_panel(page, model=model_meta["id"])
        if panel is None:
            return jsonify({"error": f"Unknown page: {page}"}), 404

        return jsonify({
            "model": model_meta,
            "models": discover_models(),
            "page": page,
            "panel": panel,
            "charts": discover_charts(page, model=model_meta["id"]),
            "defaults": collect_panel_defaults(panel),
            "sources": {
                "feature_columns": FEATURE_COLUMNS,
                "feature_count": len(FEATURE_COLUMNS),
                "default_feature": "RM",
            },
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/chart_data", methods=["POST"])
def api_chart_data():
    try:
        payload = request.get_json() or {}
        context_id = payload.get("context_id")
        if not context_id:
            return jsonify({"error": "缺少 context_id"}), 400

        context = get_context(context_id)
        page = payload.get("page") or context.get("page", "train_eval")
        if page != context.get("page"):
            return jsonify({"error": f"上下文页面不匹配：{page}"}), 400

        model = payload.get("model")
        if model and get_model(model) is None:
            return jsonify({"error": f"Unknown model: {model}"}), 404

        builders = discover_chart_builders(page, model=model)
        requested = payload.get("charts") or list(builders.keys())
        if not isinstance(requested, list):
            return jsonify({"error": "charts 必须是数组"}), 400

        state = payload.get("state") or {}
        response = {}
        for chart_id in requested:
            builder = builders.get(chart_id)
            if not builder:
                return jsonify({"error": f"未知图表：{chart_id}"}), 400
            response[chart_id] = builder["build_data"](context, state)
        return jsonify(response)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/run_action", methods=["POST"])
def api_run_action():
    try:
        if request.content_type and request.content_type.startswith("multipart/form-data"):
            action = request.form.get("action")
            handler = FORM_ACTION_HANDLERS.get(action)
            if handler is None:
                return jsonify({"error": f"Unknown action: {action}"}), 404
            return _student_upload_response(request.files.get("file"), request.form.get("source_type", "raw"))

        body = request.get_json() or {}
        action = body.get("action")
        if not action:
            return jsonify({"error": "缺少 action"}), 400

        handler = JSON_ACTION_HANDLERS.get(action)
        if handler is None:
            return jsonify({"error": f"Unknown action: {action}"}), 404

        payload = body.get("payload")
        if payload is None:
            payload = {key: value for key, value in body.items() if key != "action"}
        if not isinstance(payload, dict):
            return jsonify({"error": "payload 必须是对象"}), 400

        return _json_action_response(handler, payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
