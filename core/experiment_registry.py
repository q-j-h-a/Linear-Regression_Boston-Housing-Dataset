from core.registry import DEFAULT_MODEL_ID, discover_models, get_model


DEFAULT_EXPERIMENT_ID = "simple_linear_regression"

EXPERIMENTS = {
    "simple_linear_regression": {
        "id": "simple_linear_regression",
        "title": "简单线性回归",
        "model": DEFAULT_MODEL_ID,
        "default_page": "preprocess",
    }
}


def discover_experiments() -> list[dict]:
    models = {item.get("id"): item for item in discover_models()}
    experiments = []
    for experiment in EXPERIMENTS.values():
        data = dict(experiment)
        model = models.get(data.get("model"))
        if model:
            data["model_meta"] = model
            data.setdefault("pages", model.get("pages", []))
        experiments.append(data)
    experiments.sort(key=lambda item: item.get("id", ""))
    return experiments


def get_experiment(experiment_id: str | None = None) -> dict | None:
    selected_id = experiment_id or DEFAULT_EXPERIMENT_ID
    experiment = EXPERIMENTS.get(selected_id)
    if experiment is None:
        return None

    data = dict(experiment)
    model_id = data.get("model") or DEFAULT_MODEL_ID
    model = get_model(model_id)
    if model is None:
        return None
    data["model"] = model_id
    data["model_meta"] = model
    data.setdefault("pages", model.get("pages", []))
    return data


def resolve_experiment_model(experiment_id: str | None = None, model_id: str | None = None) -> tuple[dict, dict]:
    experiment = get_experiment(experiment_id)
    if experiment is None:
        raise ValueError(f"Unknown experiment: {experiment_id or DEFAULT_EXPERIMENT_ID}")

    resolved_model_id = model_id or experiment["model"]
    if resolved_model_id != experiment["model"]:
        raise ValueError(
            f"Model {resolved_model_id} does not belong to experiment {experiment['id']}"
        )

    model = get_model(resolved_model_id)
    if model is None:
        raise ValueError(f"Unknown model: {resolved_model_id}")
    return experiment, model
