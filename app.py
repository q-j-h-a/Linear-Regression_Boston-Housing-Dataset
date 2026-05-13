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


@app.route("/")
def index():
    load_raw_df()
    return render_template(
        "index.html",
        feature_names=FEATURE_COLUMNS,
        default_feature="RM",
    )


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
