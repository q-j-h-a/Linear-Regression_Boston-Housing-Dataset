from core.experiment_registry import resolve_experiment_model
from core.registry import discover_chart_builders, discover_charts


def discover_experiment_charts(experiment_id: str | None = None, page: str | None = None) -> list[dict]:
    _experiment, model = resolve_experiment_model(experiment_id)
    return discover_charts(page, model=model["id"])


def discover_experiment_chart_builders(
    experiment_id: str | None = None,
    page: str | None = None,
) -> dict[str, dict]:
    _experiment, model = resolve_experiment_model(experiment_id)
    return discover_chart_builders(page, model=model["id"])
