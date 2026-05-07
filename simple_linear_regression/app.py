from pathlib import Path
import numpy as np
import pandas as pd
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

RAW_DATA_PATH = Path("boston_housing.csv")
STD_DATA_PATH = Path("boston_housing_features_standardized.csv")
TARGET_COLUMN = "MEDV"

FEATURE_COLUMNS = [
    "CRIM", "ZN", "INDUS", "CHAS", "NOX", "RM", "AGE", "DIS",
    "RAD", "TAX", "PTRATIO", "B", "LSTAT"
]

FEATURE_DESCRIPTIONS = {
    "CRIM": "城镇人均犯罪率",
    "ZN": "大面积住宅用地比例",
    "INDUS": "非零售商业用地比例",
    "CHAS": "是否靠近查尔斯河：1=靠近，0=不靠近",
    "NOX": "一氧化氮浓度，反映空气污染程度",
    "RM": "住宅平均房间数",
    "AGE": "1940年前建造的自住房比例",
    "DIS": "到波士顿五个就业中心的加权距离",
    "RAD": "到放射状高速公路的可达性指数",
    "TAX": "每10000美元的房产税率",
    "PTRATIO": "城镇师生比例",
    "B": "历史种族统计相关变量，教学中建议谨慎使用",
    "LSTAT": "低收入人口比例",
}


def load_raw_df() -> pd.DataFrame:
    if not RAW_DATA_PATH.exists():
        raise FileNotFoundError(f"没有找到 {RAW_DATA_PATH.name}，请放在 app.py 同级目录")
    df = pd.read_csv(RAW_DATA_PATH)
    missing = [c for c in FEATURE_COLUMNS + [TARGET_COLUMN] if c not in df.columns]
    if missing:
        raise ValueError(f"原始数据缺少字段：{missing}")
    return df


def load_std_df() -> pd.DataFrame:
    if not STD_DATA_PATH.exists():
        raise FileNotFoundError(
            f"没有找到 {STD_DATA_PATH.name}，请先运行 03_preprocess_features_only_standardize.py 生成标准化数据集"
        )
    df = pd.read_csv(STD_DATA_PATH)
    required = FEATURE_COLUMNS + [f"{c}_standardized" for c in FEATURE_COLUMNS] + [TARGET_COLUMN]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"标准化数据缺少字段：{missing}")
    return df


def series_summary(x: pd.Series, y: pd.Series) -> dict:
    return {
        "sample_count": int(len(x)),
        "feature_min": float(x.min()),
        "feature_max": float(x.max()),
        "feature_mean": float(x.mean()),
        "feature_std": float(x.std(ddof=0)),
        "target_min": float(y.min()),
        "target_max": float(y.max()),
        "target_mean": float(y.mean()),
        "target_std": float(y.std(ddof=0)),
        "corr": float(x.corr(y)),
    }


def trend_line(x: np.ndarray, y: np.ndarray, n: int = 120) -> dict:
    w, b = np.polyfit(x, y, 1)
    x_line = np.linspace(float(np.min(x)), float(np.max(x)), n)
    y_line = w * x_line + b
    return {
        "x": x_line.round(6).tolist(),
        "y": y_line.round(6).tolist(),
        "w": float(w),
        "b": float(b),
    }


def all_correlations(df: pd.DataFrame) -> list[dict]:
    y = df[TARGET_COLUMN].astype(float)
    rows = []
    for feature in FEATURE_COLUMNS:
        corr = float(df[feature].astype(float).corr(y))
        rows.append({
            "feature": feature,
            "description": FEATURE_DESCRIPTIONS.get(feature, ""),
            "corr": corr,
            "abs_corr": abs(corr),
        })
    rows.sort(key=lambda item: item["abs_corr"], reverse=True)
    return rows


def safe_float(value, default):
    try:
        return float(value)
    except Exception:
        return default


def safe_int(value, default, lo=None, hi=None):
    try:
        v = int(value)
    except Exception:
        v = default
    if lo is not None:
        v = max(lo, v)
    if hi is not None:
        v = min(hi, v)
    return v


def compute_metrics(x: np.ndarray, y: np.ndarray, w: float, b: float) -> dict:
    y_pred = w * x + b
    err = y_pred - y
    mse = float(np.mean(err ** 2))
    rmse = float(np.sqrt(mse))
    mae = float(np.mean(np.abs(err)))
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r2 = float(1 - ss_res / ss_tot) if ss_tot != 0 else 0.0
    dw = float((2 / len(x)) * np.sum(err * x))
    db = float((2 / len(x)) * np.sum(err))
    return {
        "y_pred": y_pred,
        "err": err,
        "mse": mse,
        "rmse": rmse,
        "mae": mae,
        "r2": r2,
        "dw": dw,
        "db": db,
    }


def build_training_history(x: np.ndarray, y: np.ndarray, w0: float, b0: float, lr: float, epochs: int) -> list[dict]:
    history = []
    w = float(w0)
    b = float(b0)

    for epoch in range(epochs + 1):
        m = compute_metrics(x, y, w, b)
        new_w = w - lr * m["dw"]
        new_b = b - lr * m["db"]
        history.append({
            "epoch": epoch,
            "w": float(w),
            "b": float(b),
            "loss": m["mse"],
            "mse": m["mse"],
            "rmse": m["rmse"],
            "mae": m["mae"],
            "r2": m["r2"],
            "dw": m["dw"],
            "db": m["db"],
            "new_w": float(new_w),
            "new_b": float(new_b),
            "pred_first5": np.round(m["y_pred"][:5], 4).tolist(),
            "err_first5": np.round(m["err"][:5], 4).tolist(),
            "x_first5": np.round(x[:5], 4).tolist(),
            "y_first5": np.round(y[:5], 4).tolist(),
        })
        if epoch < epochs:
            w = new_w
            b = new_b
            if not np.isfinite(w) or not np.isfinite(b) or not np.isfinite(m["mse"]) or m["mse"] > 1e14:
                break
    return history


def build_contour(x: np.ndarray, y: np.ndarray, history: list[dict], w_ref: float, b_ref: float) -> dict:
    points_w = [row["w"] for row in history] + [w_ref]
    points_b = [row["b"] for row in history] + [b_ref]
    w_min, w_max = min(points_w), max(points_w)
    b_min, b_max = min(points_b), max(points_b)
    w_span = max(w_max - w_min, 4.0)
    b_span = max(b_max - b_min, 20.0)
    w_center = (w_min + w_max) / 2
    b_center = (b_min + b_max) / 2

    w_grid = np.linspace(w_center - w_span * 0.75, w_center + w_span * 0.75, 48)
    b_grid = np.linspace(b_center - b_span * 0.75, b_center + b_span * 0.75, 48)
    values = []
    z_list = []
    for i, b_val in enumerate(b_grid):
        for j, w_val in enumerate(w_grid):
            mse = float(np.mean((w_val * x + b_val - y) ** 2))
            values.append([j, i, mse])
            z_list.append(mse)

    return {
        "w_axis": np.round(w_grid, 5).tolist(),
        "b_axis": np.round(b_grid, 5).tolist(),
        "values": values,
        "z_min": float(np.nanmin(z_list)),
        "z_max": float(np.nanpercentile(z_list, 95)),
    }


@app.route("/")
def index():
    load_raw_df()
    return render_template(
        "index.html",
        feature_names=FEATURE_COLUMNS,
        default_feature="RM",
    )


@app.route("/api/data_view", methods=["POST"])
def api_data_view():
    try:
        payload = request.get_json() or {}
        feature = payload.get("feature", "RM")
        if feature not in FEATURE_COLUMNS:
            return jsonify({"error": f"未知特征：{feature}"}), 400

        raw = load_raw_df()
        std = load_std_df()
        y = raw[TARGET_COLUMN].astype(float)
        x_raw = raw[feature].astype(float)
        std_col = f"{feature}_standardized"
        x_std = std[std_col].astype(float)

        response = {
            "feature": feature,
            "target": TARGET_COLUMN,
            "description": FEATURE_DESCRIPTIONS.get(feature, "暂无说明"),
            "raw": {
                "scatter": {"x": x_raw.round(6).tolist(), "y": y.round(6).tolist()},
                "trend_line": trend_line(x_raw.to_numpy(), y.to_numpy()),
                "summary": series_summary(x_raw, y),
            },
            "standardized": {
                "feature_name": std_col,
                "scatter": {"x": x_std.round(6).tolist(), "y": y.round(6).tolist()},
                "trend_line": trend_line(x_std.to_numpy(), y.to_numpy()),
                "summary": series_summary(x_std, y),
            },
            "correlations": all_correlations(raw),
            "standardize_table": [
                {
                    "feature": col,
                    "standardized_feature": f"{col}_standardized",
                    "mean": float(raw[col].mean()),
                    "std": float(raw[col].std(ddof=0)),
                    "min_before": float(raw[col].min()),
                    "max_before": float(raw[col].max()),
                    "min_after": float(std[f"{col}_standardized"].min()),
                    "max_after": float(std[f"{col}_standardized"].max()),
                }
                for col in FEATURE_COLUMNS
            ]
        }
        return jsonify(response)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/train_prepare", methods=["POST"])
def api_train_prepare():
    try:
        payload = request.get_json() or {}
        feature = payload.get("feature", "RM")
        if feature not in FEATURE_COLUMNS:
            return jsonify({"error": f"未知特征：{feature}"}), 400

        use_standardized = bool(payload.get("use_standardized", True))
        lr = safe_float(payload.get("learning_rate"), 0.03)
        epochs = safe_int(payload.get("epochs"), 120, lo=1, hi=2000)
        w0 = safe_float(payload.get("w0"), 0.0)
        b0 = safe_float(payload.get("b0"), 0.0)

        df = load_std_df() if use_standardized else load_raw_df()
        x_col = f"{feature}_standardized" if use_standardized else feature
        if x_col not in df.columns:
            return jsonify({"error": f"数据中不存在字段：{x_col}"}), 400
        x = df[x_col].astype(float).to_numpy()
        y = df[TARGET_COLUMN].astype(float).to_numpy()

        w_ref, b_ref = np.polyfit(x, y, 1)
        line_x = np.linspace(float(np.min(x)), float(np.max(x)), 160)
        history = build_training_history(x, y, w0, b0, lr, epochs)
        contour = build_contour(x, y, history, float(w_ref), float(b_ref))

        return jsonify({
            "feature": feature,
            "x_column": x_col,
            "target": TARGET_COLUMN,
            "use_standardized": use_standardized,
            "description": FEATURE_DESCRIPTIONS.get(feature, "暂无说明"),
            "learning_rate": lr,
            "epochs": epochs,
            "scatter": {"x": np.round(x, 6).tolist(), "y": np.round(y, 6).tolist()},
            "line_x": np.round(line_x, 6).tolist(),
            "history": history,
            "best": {"w": float(w_ref), "b": float(b_ref)},
            "contour": contour,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/predict", methods=["POST"])
def api_predict():
    try:
        payload = request.get_json() or {}
        feature = payload.get("feature", "RM")
        value = safe_float(payload.get("value"), 6.5)
        use_standardized = bool(payload.get("use_standardized", True))
        df_raw = load_raw_df()
        df_train = load_std_df() if use_standardized else df_raw
        x_col = f"{feature}_standardized" if use_standardized else feature

        if use_standardized:
            mean = float(df_raw[feature].mean())
            std = float(df_raw[feature].std(ddof=0))
            model_x = (value - mean) / std
        else:
            mean = None
            std = None
            model_x = value

        x = df_train[x_col].astype(float).to_numpy()
        y = df_train[TARGET_COLUMN].astype(float).to_numpy()
        w, b = np.polyfit(x, y, 1)
        pred = float(w * model_x + b)
        return jsonify({
            "feature": feature,
            "raw_value": value,
            "model_x": float(model_x),
            "use_standardized": use_standardized,
            "mean": mean,
            "std": std,
            "w": float(w),
            "b": float(b),
            "prediction": pred,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
