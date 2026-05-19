from flask import Flask, render_template, request, jsonify

from core.context_store import get_context
from core.dataset_profile import build_sources_from_dataset_profile, get_experiment_dataset_profile
from core.experiment_registry import (
    DEFAULT_EXPERIMENT_ID,
    discover_experiments,
    resolve_experiment_model,
)
from core.chart_registry import discover_experiment_chart_builders, discover_experiment_charts
from core.control_registry import get_experiment_panel
from core.registry import discover_models
from core.schemas import collect_panel_defaults
from models.simple_linear_regression.model import (
    FEATURE_COLUMNS,
    JSON_ACTIONS,
    load_raw_df,
    upload_dataset as model_upload_dataset,
)

app = Flask(__name__)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.json.sort_keys = False


JSON_ACTION_HANDLERS = dict(JSON_ACTIONS)
FORM_ACTION_HANDLERS = {"upload_dataset": model_upload_dataset}

def _json_action_response(handler, payload, experiment_id=None):
    try:
        data = handler(payload)
        if experiment_id and isinstance(data, dict):
            data = dict(data)
            data["experiment"] = experiment_id
        return jsonify(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def _upload_dataset_response(file, source_type, experiment_id=None):
    try:
        data = model_upload_dataset(file, source_type)
        if experiment_id and isinstance(data, dict):
            data = dict(data)
            data["experiment"] = experiment_id
        return jsonify(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500



@app.route('/')
def index():
    load_raw_df()
    return render_template(
        "index.html",
        feature_names=FEATURE_COLUMNS,
        default_feature="RM",
    )



@app.route('/api/chart_registry', methods=['GET'])
def api_chart_registry():
    page = request.args.get("page")
    experiment_id = request.args.get("experiment")
    model = request.args.get("model")
    try:
        experiment, model_meta = resolve_experiment_model(experiment_id, model)
        return jsonify({
            "experiment": experiment,
            "model": model_meta,
            "charts": discover_experiment_charts(experiment["id"], page),
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/experiments", methods=["GET"])
def api_experiments():
    return jsonify({
        "default_experiment": DEFAULT_EXPERIMENT_ID,
        "experiments": discover_experiments(),
    })


@app.route("/api/dataset_profile", methods=["GET"])
def api_dataset_profile():
    experiment_id = request.args.get("experiment")
    model = request.args.get("model")
    try:
        experiment, _model_meta = resolve_experiment_model(experiment_id, model)
        return jsonify({
            "experiment": experiment,
            "dataset_profile": get_experiment_dataset_profile(experiment),
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/page_schema", methods=["GET"])
def api_page_schema():
    page = request.args.get("page", "train_eval")
    experiment_id = request.args.get("experiment")
    model = request.args.get("model")
    try:
        experiment, model_meta = resolve_experiment_model(experiment_id, model)
        dataset_profile = get_experiment_dataset_profile(experiment)

        panel = get_experiment_panel(page, experiment["id"])
        if panel is None:
            return jsonify({"error": f"Unknown page: {page}"}), 404

        return jsonify({
            "experiment": experiment,
            "model": model_meta,
            "experiments": discover_experiments(),
            "models": discover_models(),
            "page": page,
            "panel": panel,
            "charts": discover_experiment_charts(experiment["id"], page),
            "defaults": collect_panel_defaults(panel),
            "sources": build_sources_from_dataset_profile(dataset_profile),
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
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
        context_page = context.get("page")
        allow_evaluate_from_train = page == "evaluate" and context_page == "train_eval"
        if page != context_page and not allow_evaluate_from_train:
            return jsonify({"error": f"上下文页面不匹配：{page}"}), 400

        experiment_id = payload.get("experiment")
        model = payload.get("model")
        experiment, _model_meta = resolve_experiment_model(experiment_id, model)
        context_experiment = context.get("experiment") or DEFAULT_EXPERIMENT_ID
        if context_experiment != experiment["id"]:
            return jsonify({
                "error": (
                    "Context experiment mismatch: "
                    f"{context_experiment} != {experiment['id']}"
                )
            }), 400

        builders = discover_experiment_chart_builders(experiment["id"], page)
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
            experiment, _model_meta = resolve_experiment_model(
                request.form.get("experiment"),
                request.form.get("model"),
            )
            handler = FORM_ACTION_HANDLERS.get(action)
            if handler is None:
                return jsonify({"error": f"Unknown action: {action}"}), 404
            return _upload_dataset_response(
                request.files.get("file"),
                request.form.get("source_type", "raw"),
                experiment["id"],
            )

        body = request.get_json() or {}
        action = body.get("action")
        if not action:
            return jsonify({"error": "缺少 action"}), 400

        experiment, _model_meta = resolve_experiment_model(body.get("experiment"), body.get("model"))

        handler = JSON_ACTION_HANDLERS.get(action)
        if handler is None:
            return jsonify({"error": f"Unknown action: {action}"}), 404

        payload = body.get("payload")
        if payload is None:
            payload = {
                key: value
                for key, value in body.items()
                if key not in {"action", "experiment", "model"}
            }
        if not isinstance(payload, dict):
            return jsonify({"error": "payload 必须是对象"}), 400

        return _json_action_response(handler, payload, experiment["id"])
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
