CHART = {
    "id": "table",
    "page": "student",
    "title": "参数表",
    "subtitle": "",
    "renderer": "student_table",
    "size": "wide",
    "default": False,
    "order": 40,
}


def build_data(context, state):
    if "history" in context:
        from models.simple_linear_regression.charts.train_eval._helpers import frame_at, rows_until

        return {
            "stage": "train_prepare",
            "rows": rows_until(context, state),
            "frame": frame_at(context, state),
        }
    return {
        "stage": "data_view",
        "rows": context["standardize_table"],
    }
