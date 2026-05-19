from core.experiment_registry import resolve_experiment_model
from core.registry import get_panel


def get_experiment_panel(page: str, experiment_id: str | None = None) -> dict | None:
    _experiment, model = resolve_experiment_model(experiment_id)
    return get_panel(page, model=model["id"])
