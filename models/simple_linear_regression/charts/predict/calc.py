CHART = {
    "id": "calc",
    "page": "predict",
    "title": "预测计算过程",
    "subtitle": "输入值、模型输入、当前模型参数和预测输出",
    "renderer": "predict_calc",
    "size": "wide",
    "default": True,
    "order": 30,
}


def build_data(context, state):
    return {
        "feature": context["feature"],
        "target": context["target"],
        "raw_value": context["raw_value"],
        "input_value": context.get("input_value", context["raw_value"]),
        "input_mode": context.get("input_mode", "raw"),
        "model_x": context["model_x"],
        "use_standardized": context["use_standardized"],
        "mean": context["mean"],
        "std": context["std"],
        "w": context["w"],
        "b": context["b"],
        "model_source": context.get("model_source"),
        "model_state": context.get("model_state"),
        "prediction": context["prediction"],
    }
