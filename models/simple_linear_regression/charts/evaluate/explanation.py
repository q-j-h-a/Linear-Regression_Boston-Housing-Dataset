from models.simple_linear_regression.charts.train_eval._helpers import frame_at


CHART = {
    "id": "explanation",
    "page": "evaluate",
    "title": "评估解释",
    "subtitle": "根据当前训练轮次解释模型效果",
    "renderer": "evaluation_explanation",
    "kind": "info",
    "size": "wide",
    "default": True,
    "order": 50,
}


def _quality_label(r2):
    if r2 >= 0.75:
        return "拟合较好"
    if r2 >= 0.45:
        return "拟合一般"
    return "拟合较弱"


def build_data(context, state):
    frame = frame_at(context, state)
    target = context.get("target", "target")
    feature = context.get("feature") or context.get("x_column") or "feature"
    dataset_label = context.get("dataset_label") or context.get("dataset_id") or "当前数据集"
    r2 = float(frame.get("r2", 0))
    rmse = float(frame.get("rmse", 0))
    mae = float(frame.get("mae", 0))
    return {
        "dataset_label": dataset_label,
        "feature": feature,
        "target": target,
        "epoch": frame.get("epoch"),
        "rmse": rmse,
        "mae": mae,
        "r2": r2,
        "quality": _quality_label(r2),
        "notes": [
            f"当前使用 {feature} 解释 {target}，评估对象是 {dataset_label} 上训练出的当前模型。",
            f"RMSE={rmse:.4f}，表示预测值与真实值的典型偏差规模。",
            f"MAE={mae:.4f}，表示平均绝对误差，对极端误差不如 RMSE 敏感。",
            f"R²={r2:.4f}，当前判断为：{_quality_label(r2)}。",
        ],
    }
