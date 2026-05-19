from models.simple_linear_regression.charts.train_eval.mae import build_data


CHART = {
    "id": "mae",
    "page": "evaluate",
    "title": "MAE",
    "subtitle": "平均绝对误差，越小表示平均预测误差越小",
    "renderer": "metric_gauge",
    "metric": "mae",
    "size": "small",
    "default": True,
    "order": 30,
}
