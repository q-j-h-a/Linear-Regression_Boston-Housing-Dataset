from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd

from core.context_store import create_context, get_context


RAW_DATA_PATH = Path("boston_housing.csv")
STD_DATA_PATH = Path("boston_housing_features_standardized.csv")
TARGET_COLUMN = "MEDV"
STUDENT_DATASETS = {}

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


def all_correlations_for(df: pd.DataFrame, feature_columns: list[str], target_column: str) -> list[dict]:
    y = df[target_column].astype(float)
    rows = []
    for feature in feature_columns:
        corr = df[feature].astype(float).corr(y)
        corr = 0.0 if pd.isna(corr) else float(corr)
        rows.append({
            "feature": feature,
            "description": "",
            "corr": corr,
            "abs_corr": abs(corr),
        })
    rows.sort(key=lambda item: item["abs_corr"], reverse=True)
    return rows


def numeric_columns(df: pd.DataFrame) -> list[str]:
    cols = []
    for col in df.columns:
        converted = pd.to_numeric(df[col], errors="coerce")
        if converted.notna().sum() > 0 and converted.notna().sum() == df[col].notna().sum():
            cols.append(col)
    return cols


def clean_numeric_df(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for col in columns:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out.dropna(subset=columns).reset_index(drop=True)


def preview_records(df: pd.DataFrame, columns: list[str], limit: int = 8) -> list[dict]:
    return df.loc[:, columns].head(limit).replace({np.nan: None}).to_dict(orient="records")


def student_dataset(dataset_id: str) -> dict:
    data = STUDENT_DATASETS.get(dataset_id)
    if not data:
        raise ValueError("学生数据集不存在，请重新上传 CSV。")
    return data


def student_std_col(feature: str) -> str:
    return f"{feature}_standardized"


def student_data_response(
    raw: pd.DataFrame,
    std: pd.DataFrame,
    feature_columns: list[str],
    target_column: str,
    feature: str,
) -> dict:
    y = raw[target_column].astype(float)
    x_raw = raw[feature].astype(float)
    std_col = student_std_col(feature)
    if std is None or std_col not in std.columns:
        x_std = ((x_raw - x_raw.mean()) / x_raw.std(ddof=0)).astype(float)
    else:
        x_std = std[std_col].astype(float)
    return {
        "feature": feature,
        "target": target_column,
        "description": "",
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
        "correlations": all_correlations_for(raw, feature_columns, target_column),
        "standardize_table": [
            {
                "feature": col,
                "standardized_feature": student_std_col(col),
                "mean": float(raw[col].mean()),
                "std": float(raw[col].std(ddof=0)),
                "min_before": float(raw[col].min()),
                "max_before": float(raw[col].max()),
                "min_after": float(std[student_std_col(col)].min()) if std is not None and student_std_col(col) in std.columns else None,
                "max_after": float(std[student_std_col(col)].max()) if std is not None and student_std_col(col) in std.columns else None,
            }
            for col in feature_columns
        ],
    }


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


def training_summary(context: dict) -> dict:
    return {
        "sample_count": len(context["scatter"]["x"]),
        "feature": context["feature"],
        "x_column": context["x_column"],
        "target": context["target"],
        "use_standardized": context["use_standardized"],
        "learning_rate": context["learning_rate"],
        "epoch_count": len(context["history"]) - 1,
    }


def create_training_context(context: dict, model="simple_linear_regression", page="train_eval") -> dict:
    final_frame = context["history"][-1]
    model_state = {
        "source": "gradient_descent",
        "feature": context["feature"],
        "x_column": context["x_column"],
        "target": context["target"],
        "use_standardized": context["use_standardized"],
        "w": final_frame["w"],
        "b": final_frame["b"],
        "epoch": final_frame["epoch"],
        "learning_rate": context["learning_rate"],
    }
    stored_context = {
        "model": model,
        "page": page,
        "model_state": model_state,
        **context,
    }
    context_id = create_context(stored_context)
    return {
        "context_id": context_id,
        "model_state": model_state,
        "summary": training_summary(context),
        **context,
    }


def prepare_data_view(payload: dict) -> dict:
    feature = payload.get("feature", "RM")
    if feature not in FEATURE_COLUMNS:
        raise ValueError(f"未知特征：{feature}")

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
        ],
    }
    context_id = create_context({
        "model": "simple_linear_regression",
        "page": "preprocess",
        **response,
    })
    return {
        "context_id": context_id,
        **response,
    }


def prepare_train(payload: dict) -> dict:
    feature = payload.get("feature", "RM")
    if feature not in FEATURE_COLUMNS:
        raise ValueError(f"未知特征：{feature}")

    use_standardized = bool(payload.get("use_standardized", True))
    lr = safe_float(payload.get("learning_rate"), 0.03)
    epochs = safe_int(payload.get("epochs"), 120, lo=1, hi=2000)
    w0 = safe_float(payload.get("w0"), 0.0)
    b0 = safe_float(payload.get("b0"), 0.0)

    df = load_std_df() if use_standardized else load_raw_df()
    x_col = f"{feature}_standardized" if use_standardized else feature
    if x_col not in df.columns:
        raise ValueError(f"数据中不存在字段：{x_col}")
    x = df[x_col].astype(float).to_numpy()
    y = df[TARGET_COLUMN].astype(float).to_numpy()

    w_ref, b_ref = np.polyfit(x, y, 1)
    line_x = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    history = build_training_history(x, y, w0, b0, lr, epochs)
    contour = build_contour(x, y, history, float(w_ref), float(b_ref))

    context = {
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
    }
    return create_training_context(context)


def prediction_model_from_training_context(payload: dict) -> dict:
    train_context_id = payload.get("train_context_id")
    if not train_context_id:
        raise ValueError("请先在“模型训练与评估”页完成一次训练，再进行预测。")

    train_context = get_context(train_context_id)
    if train_context.get("page") != "train_eval":
        raise ValueError("预测只能使用模型训练与评估页生成的模型。")

    history = train_context.get("history") or []
    if not history:
        raise ValueError("训练上下文中没有可用的模型参数。")

    frame_index = safe_int(payload.get("train_frame_index"), len(history) - 1, lo=0, hi=len(history) - 1)
    frame = history[frame_index]
    return {
        "train_context_id": train_context_id,
        "train_frame_index": frame_index,
        "source": "train_eval_current",
        "source_label": f"模型训练与评估页 epoch {frame['epoch']}",
        "feature": train_context["feature"],
        "target": train_context["target"],
        "x_column": train_context["x_column"],
        "use_standardized": train_context["use_standardized"],
        "w": float(frame["w"]),
        "b": float(frame["b"]),
        "epoch": int(frame["epoch"]),
        "learning_rate": train_context.get("learning_rate"),
    }


def predict(payload: dict) -> dict:
    model_state = prediction_model_from_training_context(payload)
    feature = model_state["feature"]
    if feature not in FEATURE_COLUMNS:
        raise ValueError(f"未知特征：{feature}")
    value = safe_float(payload.get("value"), 6.5)
    input_mode = payload.get("input_mode", "raw")
    if input_mode not in {"raw", "standardized"}:
        raise ValueError("输入类型必须是 raw 或 standardized。")
    use_standardized = bool(model_state["use_standardized"])
    if input_mode == "standardized" and not use_standardized:
        raise ValueError("当前模型使用原始特征训练，预测输入不能选择标准化特征。")
    df_raw = load_raw_df()
    df_train = load_std_df() if use_standardized else df_raw
    x_col = model_state["x_column"]

    if use_standardized:
        mean = float(df_raw[feature].mean())
        std = float(df_raw[feature].std(ddof=0))
        if input_mode == "standardized":
            model_x = value
            raw_value = value * std + mean
        else:
            raw_value = value
            model_x = (value - mean) / std
    else:
        mean = None
        std = None
        raw_value = value
        model_x = value

    x = df_train[x_col].astype(float).to_numpy()
    y = df_train[TARGET_COLUMN].astype(float).to_numpy()
    w = model_state["w"]
    b = model_state["b"]
    pred = float(w * model_x + b)
    line_x = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    line_y = w * line_x + b
    raw_x = df_raw[feature].astype(float).to_numpy()
    distances = np.abs(raw_x - raw_value)
    nearest_idx = np.argsort(distances)[:5]
    nearby = []
    for idx in nearest_idx:
        nearby.append({
            "index": int(idx),
            "raw_x": float(raw_x[idx]),
            "model_x": float(x[idx]),
            "y": float(y[idx]),
            "distance": float(distances[idx]),
        })
    response = {
        "feature": feature,
        "description": FEATURE_DESCRIPTIONS.get(feature, "暂无说明"),
        "target": TARGET_COLUMN,
        "x_column": x_col,
        "raw_value": float(raw_value),
        "input_value": value,
        "input_mode": input_mode,
        "model_x": float(model_x),
        "use_standardized": use_standardized,
        "mean": mean,
        "std": std,
        "w": float(w),
        "b": float(b),
        "model_state": model_state,
        "model_source": model_state["source_label"],
        "train_context_id": model_state["train_context_id"],
        "train_frame_index": model_state["train_frame_index"],
        "prediction": pred,
        "scatter": {"x": np.round(x, 6).tolist(), "y": np.round(y, 6).tolist()},
        "line": {"x": np.round(line_x, 6).tolist(), "y": np.round(line_y, 6).tolist()},
        "predict_point": {"x": float(model_x), "y": pred, "raw_x": float(raw_value)},
        "nearby": nearby,
        "summary": series_summary(pd.Series(x), pd.Series(y)),
    }
    context_id = create_context({
        "model": "simple_linear_regression",
        "page": "predict",
        **response,
    })
    return {
        "context_id": context_id,
        **response,
    }


def student_upload(file, source_type: str = "raw") -> dict:
    if not file or not file.filename:
        raise ValueError("请上传 CSV 文件。")
    if not file.filename.lower().endswith(".csv"):
        raise ValueError("当前只支持 CSV 文件。")

    df = pd.read_csv(file)
    if df.empty:
        raise ValueError("CSV 文件没有可用数据。")
    df.columns = [str(col).strip() for col in df.columns]
    nums = numeric_columns(df)
    if len(nums) < 2:
        raise ValueError("至少需要 2 个数值列：1 个特征列和 1 个目标列。")

    target = df.columns[-1]
    if target not in nums:
        raise ValueError("CSV 最后一列必须是数值目标列，目标列不参与预处理标准化。")
    features = [col for col in nums if col != target]

    dataset_id = uuid4().hex
    STUDENT_DATASETS[dataset_id] = {
        "raw": df,
        "std": df.copy() if source_type == "standardized" else None,
        "source_type": source_type,
    }
    return {
        "dataset_id": dataset_id,
        "source_type": source_type,
        "row_count": int(len(df)),
        "columns": df.columns.tolist(),
        "numeric_columns": nums,
        "target": target,
        "features": features,
        "preview_columns": df.columns.tolist(),
        "preview": preview_records(df, df.columns.tolist()),
    }


def student_preprocess(payload: dict) -> dict:
    data = student_dataset(payload.get("dataset_id"))
    raw = data["raw"]
    target = raw.columns[-1]
    numeric = numeric_columns(raw)
    if target not in numeric:
        raise ValueError("CSV 最后一列必须是数值目标列，目标列不参与预处理标准化。")
    features = [col for col in numeric if col != target]
    if not target or not features:
        raise ValueError("请选择目标列和至少一个特征列。")

    missing = [col for col in features + [target] if col not in raw.columns]
    if missing:
        raise ValueError(f"数据集中不存在字段：{missing}")
    if target in features:
        raise ValueError("目标列不能同时作为特征列。")

    cleaned = clean_numeric_df(raw, features + [target])
    if len(cleaned) < 2:
        raise ValueError("清洗缺失值后样本不足，至少需要 2 行有效数据。")

    std = cleaned.copy()
    table = []
    for feature in features:
        mean = float(cleaned[feature].mean())
        sigma = float(cleaned[feature].std(ddof=0))
        if sigma == 0:
            raise ValueError(f"特征 {feature} 的标准差为 0，无法标准化。")
        std_col = student_std_col(feature)
        std[std_col] = (cleaned[feature] - mean) / sigma
        table.append({
            "feature": feature,
            "standardized_feature": std_col,
            "mean": mean,
            "std": sigma,
            "min_before": float(cleaned[feature].min()),
            "max_before": float(cleaned[feature].max()),
            "min_after": float(std[std_col].min()),
            "max_after": float(std[std_col].max()),
        })

    data["raw"] = cleaned
    data["std"] = std
    data["features"] = features
    data["target"] = target
    preview_columns = [student_std_col(feature) for feature in features] + [target]
    return {
        "dataset_id": payload.get("dataset_id"),
        "row_count": int(len(cleaned)),
        "features": features,
        "target": target,
        "standardize_table": table,
        "preview_columns": preview_columns,
        "preview": preview_records(std, preview_columns),
    }


def student_prepare_data_view(payload: dict) -> dict:
    data = student_dataset(payload.get("dataset_id"))
    target = payload.get("target")
    features = payload.get("features") or []
    feature = payload.get("feature")
    if not target or not features or not feature:
        raise ValueError("请选择目标列、特征列和当前观察特征。")
    raw = clean_numeric_df(data["raw"], features + [target])
    std = data.get("std")
    if std is not None:
        std = clean_numeric_df(
            std,
            [col for col in std.columns if col in features + [target] or col.endswith("_standardized")],
        )
    response = student_data_response(raw, std, features, target, feature)
    context_id = create_context({
        "model": "student_linear_regression",
        "page": "student",
        "stage": "data_view",
        **response,
    })
    return {
        "context_id": context_id,
        **response,
    }


def student_prepare_train(payload: dict) -> dict:
    data = student_dataset(payload.get("dataset_id"))
    target = payload.get("target")
    feature = payload.get("feature")
    features = payload.get("features") or [feature]
    use_standardized = bool(payload.get("use_standardized", True))
    lr = safe_float(payload.get("learning_rate"), 0.03)
    epochs = safe_int(payload.get("epochs"), 120, lo=1, hi=2000)
    w0 = safe_float(payload.get("w0"), 0.0)
    b0 = safe_float(payload.get("b0"), 0.0)

    raw = clean_numeric_df(data["raw"], features + [target])
    std = data.get("std")
    x_col = student_std_col(feature) if use_standardized else feature
    if use_standardized:
        if std is None or x_col not in std.columns:
            raise ValueError("请先执行预处理，或上传包含标准化列的预处理数据集。")
        df_train = clean_numeric_df(std, [x_col, target])
    else:
        df_train = raw
    x = df_train[x_col].astype(float).to_numpy()
    y = df_train[target].astype(float).to_numpy()
    if len(x) < 2:
        raise ValueError("有效样本不足，至少需要 2 行数据。")

    w_ref, b_ref = np.polyfit(x, y, 1)
    line_x = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    history = build_training_history(x, y, w0, b0, lr, epochs)
    contour = build_contour(x, y, history, float(w_ref), float(b_ref))
    context = {
        "stage": "train_prepare",
        "feature": feature,
        "x_column": x_col,
        "target": target,
        "use_standardized": use_standardized,
        "description": "",
        "learning_rate": lr,
        "epochs": epochs,
        "scatter": {"x": np.round(x, 6).tolist(), "y": np.round(y, 6).tolist()},
        "line_x": np.round(line_x, 6).tolist(),
        "history": history,
        "best": {"w": float(w_ref), "b": float(b_ref)},
        "contour": contour,
    }
    return create_training_context(context, model="student_linear_regression", page="student")


def student_predict(payload: dict) -> dict:
    data = student_dataset(payload.get("dataset_id"))
    target = payload.get("target")
    feature = payload.get("feature")
    features = payload.get("features") or [feature]
    value = safe_float(payload.get("value"), 0.0)
    use_standardized = bool(payload.get("use_standardized", True))
    raw = clean_numeric_df(data["raw"], features + [target])
    std = data.get("std")
    x_col = student_std_col(feature) if use_standardized else feature

    if use_standardized:
        if std is None or x_col not in std.columns:
            raise ValueError("请先执行预处理，或上传包含标准化列的预处理数据集。")
        mean = float(raw[feature].mean())
        sigma = float(raw[feature].std(ddof=0))
        if sigma == 0:
            raise ValueError(f"特征 {feature} 的标准差为 0，无法预测。")
        model_x = (value - mean) / sigma
        df_train = clean_numeric_df(std, [x_col, target])
    else:
        mean = None
        sigma = None
        model_x = value
        df_train = raw

    x = df_train[x_col].astype(float).to_numpy()
    y = df_train[target].astype(float).to_numpy()
    w, b = np.polyfit(x, y, 1)
    pred = float(w * model_x + b)
    line_x = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    line_y = w * line_x + b
    raw_x = raw[feature].astype(float).to_numpy()
    distances = np.abs(raw_x - value)
    nearest_idx = np.argsort(distances)[:5]
    nearby = [{
        "index": int(idx),
        "raw_x": float(raw_x[idx]),
        "model_x": float(x[idx]),
        "y": float(y[idx]),
        "distance": float(distances[idx]),
    } for idx in nearest_idx]
    response = {
        "feature": feature,
        "description": "",
        "target": target,
        "x_column": x_col,
        "raw_value": value,
        "model_x": float(model_x),
        "use_standardized": use_standardized,
        "mean": mean,
        "std": sigma,
        "w": float(w),
        "b": float(b),
        "prediction": pred,
        "scatter": {"x": np.round(x, 6).tolist(), "y": np.round(y, 6).tolist()},
        "line": {"x": np.round(line_x, 6).tolist(), "y": np.round(line_y, 6).tolist()},
        "predict_point": {"x": float(model_x), "y": pred, "raw_x": value},
        "nearby": nearby,
        "summary": series_summary(pd.Series(x), pd.Series(y)),
    }
    context_id = create_context({
        "model": "student_linear_regression",
        "page": "student",
        "stage": "predict",
        **response,
    })
    return {
        "context_id": context_id,
        **response,
    }


JSON_ACTIONS = {
    "data_view": prepare_data_view,
    "prepare_train": prepare_train,
    "train_prepare": prepare_train,
    "predict": predict,
    "student_preprocess": student_preprocess,
    "student_data_view": student_prepare_data_view,
    "student_prepare_train": student_prepare_train,
    "student_train_prepare": student_prepare_train,
    "student_predict": student_predict,
}
