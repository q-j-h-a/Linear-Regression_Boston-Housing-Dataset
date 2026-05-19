from models.simple_linear_regression.charts.train_eval.r2 import build_data


CHART = {
    "id": "r2",
    "page": "evaluate",
    "title": "R²",
    "subtitle": "决定系数，越接近 1 表示线性模型解释能力越强",
    "renderer": "metric_gauge",
    "metric": "r2",
    "size": "small",
    "default": True,
    "order": 40,
}
