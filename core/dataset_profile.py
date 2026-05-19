from importlib import import_module


def get_experiment_dataset_profile(experiment: dict) -> dict:
    model_id = experiment.get("model")
    if not model_id:
        raise ValueError(f"Experiment has no model mapping: {experiment.get('id')}")

    try:
        module = import_module(f"models.{model_id}.dataset")
    except ModuleNotFoundError as exc:
        if exc.name == f"models.{model_id}.dataset":
            return empty_dataset_profile(experiment)
        raise

    get_profile = getattr(module, "get_dataset_profile", None)
    if not callable(get_profile):
        return empty_dataset_profile(experiment)

    profile = get_profile()
    if not isinstance(profile, dict):
        raise ValueError(f"Dataset profile for {experiment.get('id')} must be a dict")
    return normalize_dataset_profile(profile)


def empty_dataset_profile(experiment: dict) -> dict:
    return normalize_dataset_profile({
        "id": f"{experiment.get('id')}_dataset",
        "name": "Dataset",
        "columns": [],
        "variants": [],
    })


def normalize_dataset_profile(profile: dict) -> dict:
    data = dict(profile)
    data.setdefault("id", "dataset")
    data.setdefault("name", data["id"])
    data.setdefault("columns", [])
    data.setdefault("variants", [])
    data.setdefault("default_features", [])
    data.setdefault("default_target", "")
    data.setdefault("default_variant", data["variants"][0]["id"] if data["variants"] else "")
    data.setdefault("preview_policy", {
        "mode": "full",
        "preview_rows": 100,
        "chart_sample_rows": 1000,
    })
    return data


def build_sources_from_dataset_profile(profile: dict) -> dict:
    columns = profile.get("columns") or []
    feature_columns = [
        column.get("name")
        for column in columns
        if column.get("role") == "feature" and column.get("name")
    ]
    target_columns = [
        column.get("name")
        for column in columns
        if column.get("role") == "target" and column.get("name")
    ]
    numeric_columns = [
        column.get("name")
        for column in columns
        if column.get("type") == "number" and column.get("name")
    ]

    default_features = [
        feature
        for feature in (profile.get("default_features") or [])
        if feature in feature_columns
    ]
    if not default_features and feature_columns:
        default_features = [feature_columns[0]]

    default_target = profile.get("default_target") or (target_columns[0] if target_columns else "")
    default_feature = default_features[0] if default_features else ""

    return {
        "dataset_profile": profile,
        "dataset_variants": profile.get("variants") or [],
        "default_dataset_variant": profile.get("default_variant") or "",
        "feature_columns": feature_columns,
        "feature_count": len(feature_columns),
        "default_feature": default_feature,
        "default_features": default_features,
        "target_columns": target_columns,
        "target_column": default_target,
        "default_target": default_target,
        "numeric_columns": numeric_columns,
    }
