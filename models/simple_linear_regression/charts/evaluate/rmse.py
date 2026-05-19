from models.simple_linear_regression.charts.train_eval.rmse import build_data


CHART = {
    "id": "rmse",
    "page": "evaluate",
    "title": "RMSE",
    "subtitle": "均方根误差，越小表示整体预测偏差越小",
    "renderer": "metric_gauge",
    "metric": "rmse",
    "size": "small",
    "default": True,
    "order": 20,
}
