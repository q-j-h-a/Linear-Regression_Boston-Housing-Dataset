from models.simple_linear_regression.charts.train_eval.model_train import build_data


CHART = {
    "id": "model_fit",
    "page": "evaluate",
    "title": "拟合效果",
    "subtitle": "当前训练模型在样本上的拟合线和最优参考线",
    "renderer": "linear_train_scatter",
    "size": "wide",
    "default": True,
    "order": 10,
}
