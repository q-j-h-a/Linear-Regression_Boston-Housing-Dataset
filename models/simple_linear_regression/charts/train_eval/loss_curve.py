CHART = {
    "id": "learning",
    "page": "train_eval",
    "title": "学习准则",
    "subtitle": "MSE Loss 随 epoch 的变化",
    "renderer": "loss_curve",
    "size": "",
    "default": True,
    "order": 20,
}


from models.simple_linear_regression.charts.train_eval._helpers import frame_at, rows_until


def build_data(context, state):
    rows = rows_until(context, state)
    return {
        "x_name": "epoch",
        "y_name": "MSE",
        "series_name": "MSE",
        "data": [[row["epoch"], row["mse"]] for row in rows],
        "color": "#5b35f5",
        "frame": frame_at(context, state),
    }
