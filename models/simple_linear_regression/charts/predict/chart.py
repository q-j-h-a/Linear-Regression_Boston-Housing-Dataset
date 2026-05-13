CHART = {
    "id": "chart",
    "page": "predict",
    "title": "预测可视化",
    "subtitle": "样本点、回归线、输入点与预测点",
    "renderer": "predict_chart",
    "size": "wide",
    "default": True,
    "order": 20,
}


def build_data(context, state):
    return {
        "x_name": context["x_column"],
        "y_name": context["target"],
        "scatter": context["scatter"],
        "line": context["line"],
        "predict_point": context["predict_point"],
        "model_x": context["model_x"],
        "prediction": context["prediction"],
    }
