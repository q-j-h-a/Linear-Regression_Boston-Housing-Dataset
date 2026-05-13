CHART = {
    "id": "metrics",
    "page": "student",
    "title": "评估标准图",
    "subtitle": "RMSE、MAE、R² 当前值与训练趋势",
    "renderer": "student_metrics",
    "size": "wide",
    "default": False,
    "order": 80,
}


from models.simple_linear_regression.charts.train_eval._helpers import frame_at, rows_until


def build_data(context, state):
    rows = rows_until(context, state)
    frame = frame_at(context, state)
    metrics = {}
    for metric in ("rmse", "mae", "r2"):
        values = [row[metric] for row in rows]
        metrics[metric] = {
            "value": frame[metric],
            "data": [[row["epoch"], row[metric]] for row in rows],
            "max": max(values + [1]),
        }
    return {
        "x_name": "epoch",
        "metrics": metrics,
        "frame": frame,
    }
