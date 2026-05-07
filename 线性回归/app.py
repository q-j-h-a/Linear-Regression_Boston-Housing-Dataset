from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BOSTON_DATA_URL = "http://lib.stat.cmu.edu/datasets/boston"
FEATURE_NAMES = [
    "CRIM（城镇人均犯罪率）",
    "ZN（非零售用地比例）",
    "INDUS（城镇中非住宅用地比例）",
    "CHAS（是否邻近河流）",
    "NOX（一氧化氮浓度）",
    "RM（平均房间数）",
    "AGE（建造于1940年之前的房屋比例）",
    "DIS（到波士顿中心的距离）",
    "RAD（道路便利性指数）",
    "TAX（每万美元的财产税率）",
    "PTRATIO（师生比例）",
    "B（黑人比例）",
    "LSTAT（低收入人群比例）",
]
DEFAULT_FEATURE_NAME = FEATURE_NAMES[5]
FEATURE_SET = set(FEATURE_NAMES)
TARGET_NAME = "MEDV"


@dataclass
class TrainingResult:
    scatter: Dict[str, List[float]]
    line: Dict[str, List[float]]
    loss_curve: List[Dict[str, float]]
    params_history: List[Dict[str, float]]
    final_params: Dict[str, float]
    metrics: Dict[str, float]
    x_line: List[float]


def load_boston_data() -> pd.DataFrame:
    """加载波士顿房价数据，保留全部 13 个特征。"""
    raw_df = pd.read_csv(BOSTON_DATA_URL, sep=r"\s+", skiprows=22, header=None)
    data_array = np.hstack([raw_df.values[::2, :], raw_df.values[1::2, :2]])
    target = raw_df.values[1::2, 2].astype(float)
    df = pd.DataFrame(data_array, columns=FEATURE_NAMES)
    df[TARGET_NAME] = target
    return df


DATASET = load_boston_data()


def get_feature_arrays(feature_name: str) -> tuple[np.ndarray, np.ndarray]:
    normalized = str(feature_name).strip().upper()
    if normalized not in FEATURE_SET:
        raise ValueError(f"不支持的特征：{feature_name}")

    x = DATASET[normalized].to_numpy(dtype=float)
    y = DATASET[TARGET_NAME].to_numpy(dtype=float)
    return x, y


def mse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean((y_true - y_pred) ** 2))


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(mse(y_true, y_pred)))


def r2_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    return float(1 - ss_res / ss_tot)


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def to_raw_params(w_norm: float, b_norm: float, x_mean: float, x_std: float, y_mean: float, y_std: float) -> Dict[str, float]:
    w_raw = (y_std / x_std) * w_norm
    b_raw = y_mean + y_std * b_norm - w_raw * x_mean
    return {"w": float(w_raw), "b": float(b_raw)}


def train_gradient_descent(
    x: np.ndarray,
    y: np.ndarray,
    learning_rate: float,
    epochs: int,
) -> Dict[str, Any]:
    """手写梯度下降，返回每轮参数、loss 曲线和最终回归线。"""
    x_mean = float(np.mean(x))
    x_std = float(np.std(x)) or 1.0
    y_mean = float(np.mean(y))
    y_std = float(np.std(y)) or 1.0

    x_norm = (x - x_mean) / x_std
    y_norm = (y - y_mean) / y_std

    w = 0.0
    b = 0.0

    params_history: List[Dict[str, float]] = []
    loss_curve: List[Dict[str, float]] = []
    converged = True

    sample_count = len(x_norm)

    for epoch in range(1, epochs + 1):
        y_pred_norm = w * x_norm + b
        error = y_pred_norm - y_norm

        dw = (2.0 / sample_count) * np.sum(x_norm * error)
        db = (2.0 / sample_count) * np.sum(error)

        w -= learning_rate * dw
        b -= learning_rate * db

        raw_params = to_raw_params(w, b, x_mean, x_std, y_mean, y_std)
        y_pred_raw = raw_params["w"] * x + raw_params["b"]
        current_loss = mse(y, y_pred_raw)

        if not np.isfinite(current_loss) or not np.isfinite(raw_params["w"]) or not np.isfinite(raw_params["b"]):
            converged = False
            break

        params_history.append(
            {
                "epoch": epoch,
                "w": raw_params["w"],
                "b": raw_params["b"],
                "loss": current_loss,
            }
        )
        loss_curve.append({"epoch": epoch, "loss": current_loss})

    if params_history:
        final_params = params_history[-1]
    else:
        final_params = {"epoch": 0, "w": 0.0, "b": float(np.mean(y)), "loss": mse(y, np.full_like(y, np.mean(y)))}

    x_line = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    line_y = final_params["w"] * x_line + final_params["b"]
    y_pred_all = final_params["w"] * x + final_params["b"]

    metrics = {
        "mae": mae(y, y_pred_all),
        "rmse": rmse(y, y_pred_all),
        "r2": r2_score(y, y_pred_all),
        "final_loss": final_params["loss"],
        "converged": bool(converged),
    }

    return {
        "scatter": {"x": x.tolist(), "y": y.tolist()},
        "line": {"x": x_line.tolist(), "y": line_y.tolist()},
        "loss_curve": loss_curve,
        "params_history": params_history,
        "final_params": final_params,
        "metrics": metrics,
        "x_line": x_line.tolist(),
    }


def compare_learning_rates(x: np.ndarray, y: np.ndarray, learning_rates: List[float], epochs: int) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for lr in learning_rates:
        trained = train_gradient_descent(x, y, lr, epochs)
        results.append(
            {
                "learning_rate": lr,
                "loss_curve": trained["loss_curve"],
                "final_params": trained["final_params"],
                "metrics": trained["metrics"],
            }
        )
    return results


@app.route("/")
def index() -> str:
    return render_template(
        "index.html",
        feature_names=FEATURE_NAMES,
        default_feature=DEFAULT_FEATURE_NAME,
    )


@app.route("/api/data", methods=["GET"])
def api_data():
    x, y = get_feature_arrays(DEFAULT_FEATURE_NAME)
    return jsonify(
        {
            "scatter": {"x": x.tolist(), "y": y.tolist()},
            "feature": DEFAULT_FEATURE_NAME,
            "feature_options": FEATURE_NAMES,
        }
    )


@app.route("/api/train", methods=["POST"])
def api_train():
    payload = request.get_json(silent=True) or {}
    learning_rate = float(payload.get("learning_rate", 0.05))
    epochs = int(payload.get("epochs", 120))
    compare_lrs = payload.get("compare_learning_rates", [])
    feature_name = str(payload.get("feature_name", DEFAULT_FEATURE_NAME)).strip().upper()

    if learning_rate <= 0:
        return jsonify({"error": "learning_rate 必须大于 0"}), 400
    if epochs <= 0:
        return jsonify({"error": "epochs 必须大于 0"}), 400
    if feature_name not in FEATURE_SET:
        return jsonify({"error": f"feature_name 必须是以下之一：{', '.join(FEATURE_NAMES)}"}), 400

    x_raw, y_raw = get_feature_arrays(feature_name)
    result = train_gradient_descent(x_raw, y_raw, learning_rate, epochs)

    response = {
        "feature": feature_name,
        "feature_options": FEATURE_NAMES,
        "scatter": result["scatter"],
        "line": result["line"],
        "loss_curve": result["loss_curve"],
        "params_history": result["params_history"],
        "final_params": result["final_params"],
        "metrics": result["metrics"],
        "training_summary": {
            "learning_rate": learning_rate,
            "epochs": epochs,
            "trained_epochs": len(result["params_history"]),
        },
    }

    if compare_lrs:
        cleaned = []
        for item in compare_lrs:
            try:
                value = float(item)
                if value > 0:
                    cleaned.append(value)
            except (TypeError, ValueError):
                continue
        if cleaned:
            response["compare_results"] = compare_learning_rates(x_raw, y_raw, cleaned, epochs)

    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
