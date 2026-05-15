import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
import asyncio
from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path

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
THEORY_ASSISTANT_MODEL = os.getenv("THEORY_ASSISTANT_MODEL", "JoyAI-1.3T")
THEORY_ASSISTANT_BASE_URL = os.getenv("THEORY_ASSISTANT_BASE_URL", "https://api.masterjie.eu.cc/v1").rstrip("/")
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


def _request_chat_completion(messages, max_tokens):
    api_key = os.getenv("THEORY_ASSISTANT_API_KEY")
    if not api_key:
        raise RuntimeError("未配置 THEORY_ASSISTANT_API_KEY")

    payload = {
        "model": THEORY_ASSISTANT_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": max_tokens,
    }
    req = urllib.request.Request(
        f"{THEORY_ASSISTANT_BASE_URL}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "LinearRegressionTeachingLab/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("AI 接口返回格式异常") from exc


def _request_theory_explanation(title, text):
    return _request_chat_completion(
        [
            {
                "role": "system",
                "content": "你是一个中文机器学习实验课助教，擅长把线性回归理论讲得清楚、自然、适合朗读。",
            },
            {"role": "user", "content": _build_theory_explain_prompt(title, text)},
        ],
        max_tokens=480,
    )


def _request_theory_answer(title, text, question, history=None, pages=None):
    cleaned_history = _clean_theory_chat_history(history)
    cleaned_pages = _build_theory_page_context(pages, title)
    return _request_chat_completion(
        [
            {
                "role": "system",
                "content": "你是一个中文机器学习实验课助教，只根据已提供的理论页资料和历史对话回答学生问题。",
            },
            {"role": "user", "content": _build_theory_chat_prompt(title, text, question, cleaned_history, cleaned_pages)},
        ],
        max_tokens=320,
    )


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


def _tts_audio(text, voice, rate):
    if voice in EDGE_TTS_VOICES:
        return _edge_tts_audio(text, voice, rate), "audio/mpeg", "edge"
    return _local_tts_audio(text, voice, 180 * rate), "audio/mp4", "macos"


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
        return jsonify({
            "model": THEORY_ASSISTANT_MODEL,
            "explanation": _request_theory_explanation(title, text),
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
        return jsonify({
            "model": THEORY_ASSISTANT_MODEL,
            "answer": _request_theory_answer(title, text, question, history, pages),
        })
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return jsonify({"error": f"AI 接口请求失败：HTTP {exc.code} {detail}"}), 502
    except Exception as exc:
        return jsonify({"error": f"AI 问答失败：{exc}"}), 500


@app.route("/api/tts", methods=["POST"])
@app.route("/api/local_tts", methods=["POST"])
def api_tts():
    body = request.get_json() or {}
    text = str(body.get("text") or "").strip()
    voice = str(body.get("voice") or "zh-CN-XiaoxiaoNeural").strip()
    try:
        rate = float(body.get("rate") or 1.12)
    except (TypeError, ValueError):
        rate = 1.12
    rate = min(1.45, max(0.85, rate))
    if len(text) < 2:
        return jsonify({"error": "缺少需要朗读的文本。"}), 400
    try:
        audio, content_type, provider = _tts_audio(text, voice, rate)
        resp = make_response(audio)
        resp.headers["Content-Type"] = content_type
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["X-TTS-Provider"] = provider
        return resp
    except FileNotFoundError:
        return jsonify({"error": "当前系统缺少 say 或 afconvert，无法生成本机语音。"}), 500
    except ImportError:
        return jsonify({"error": "当前环境缺少 edge-tts，请先安装依赖。"}), 500
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or b"").decode("utf-8", errors="replace")[:200]
        return jsonify({"error": f"本机语音生成失败：{detail or exc}"}), 500
    except subprocess.TimeoutExpired:
        return jsonify({"error": "本机语音生成超时，文本可能太长。"}), 504
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
