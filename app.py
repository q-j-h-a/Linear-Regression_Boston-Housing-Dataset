import json
import os
import urllib.error
import urllib.request

from flask import Flask, render_template, request, jsonify

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


def _build_theory_chat_prompt(title, text, question):
    clipped_text = text[:7000]
    clipped_question = question[:800]
    return (
        "请基于当前理论页内容回答学生问题。\n"
        "要求：\n"
        "1. 只使用页面正文明确出现的信息，不补充正文里没有出现的字段、数据、公式或案例。\n"
        "2. 如果问题超出当前页面内容，请直接说明当前页面没有说明这点，并引导学生查看相关页面。\n"
        "3. 回答要适合语音朗读，控制在 120 到 260 字之间。\n"
        "4. 不要使用 Markdown 标题、表格和项目符号。\n\n"
        f"页面标题：{title}\n\n"
        f"页面正文：\n{clipped_text}\n\n"
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


def _request_theory_answer(title, text, question):
    return _request_chat_completion(
        [
            {
                "role": "system",
                "content": "你是一个中文机器学习实验课助教，只根据当前页面内容回答学生问题。",
            },
            {"role": "user", "content": _build_theory_chat_prompt(title, text, question)},
        ],
        max_tokens=320,
    )


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
    if len(text) < 20:
        return jsonify({"error": "当前页面文本太少，无法回答问题。"}), 400
    if len(question) < 2:
        return jsonify({"error": "请输入要提问的内容。"}), 400
    try:
        return jsonify({
            "model": THEORY_ASSISTANT_MODEL,
            "answer": _request_theory_answer(title, text, question),
        })
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        return jsonify({"error": f"AI 接口请求失败：HTTP {exc.code} {detail}"}), 502
    except Exception as exc:
        return jsonify({"error": f"AI 问答失败：{exc}"}), 500


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
