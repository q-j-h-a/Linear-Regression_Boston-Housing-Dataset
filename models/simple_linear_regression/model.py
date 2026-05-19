from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd

from core.context_store import create_context, get_context


DATASET_ROOT = Path("datasets")
RAW_DATA_PATH = DATASET_ROOT / "raw" / "boston_housing.csv"
STD_DATA_PATH = DATASET_ROOT / "preprocessed" / "boston_housing_preprocessed.csv"
TARGET_COLUMN = "MEDV"
CUSTOM_DATASETS = {}

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

FIELD_MEANINGS = {
    "CRIM": "城镇人均犯罪率",
    "ZN": "大面积住宅用地比例",
    "INDUS": "非零售商业用地比例",
    "CHAS": "是否靠近查尔斯河",
    "NOX": "一氧化氮浓度",
    "RM": "住宅平均房间数",
    "AGE": "1940年前建成的自住房比例",
    "DIS": "到波士顿就业中心的加权距离",
    "RAD": "到放射状高速公路的可达性指数",
    "TAX": "每10000美元房产税率",
    "PTRATIO": "城镇师生比例",
    "B": "历史人口统计相关变量",
    "LSTAT": "低收入人口比例",
    "MEDV": "房价中位数",
}


def load_raw_df() -> pd.DataFrame:
    if not RAW_DATA_PATH.exists():
        raise FileNotFoundError(f"没有找到 {RAW_DATA_PATH.name}，请放在 app.py 同级目录")
    df = pd.read_csv(RAW_DATA_PATH)
    missing = [c for c in FEATURE_COLUMNS + [TARGET_COLUMN] if c not in df.columns]
    if missing:
        raise ValueError(f"原始数据缺少字段：{missing}")
    return df.loc[:, FEATURE_COLUMNS + [TARGET_COLUMN]]


def load_std_df() -> pd.DataFrame:
    if not STD_DATA_PATH.exists():
        raise FileNotFoundError(
            f"没有找到 {STD_DATA_PATH.name}，请先运行 03_preprocess_features_only_standardize.py 生成标准化数据集"
        )
    df = pd.read_csv(STD_DATA_PATH)
    required = FEATURE_COLUMNS + [TARGET_COLUMN]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"标准化数据缺少字段：{missing}")
    return df.loc[:, required]


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


def dataset_quality(raw: pd.DataFrame) -> dict:
    numeric = numeric_columns(raw)
    return {
        "missing_count": int(raw.isna().sum().sum()),
        "duplicate_count": int(raw.duplicated().sum()),
        "numeric_column_count": int(len(numeric)),
        "non_numeric_column_count": int(len(raw.columns) - len(numeric)),
    }


def statistical_summary(raw: pd.DataFrame, columns: list[str]) -> list[dict]:
    rows = []
    for col in columns:
        series = pd.to_numeric(raw[col], errors="coerce").dropna()
        if series.empty:
            continue
        rows.append({
            "feature": col,
            "min": float(series.min()),
            "max": float(series.max()),
            "mean": float(series.mean()),
            "std": float(series.std(ddof=0)),
        })
    return rows


def data_dictionary(feature_columns: list[str], target_column: str) -> list[dict]:
    rows = [
        {
            "field": feature,
            "role": "特征",
            "meaning": FIELD_MEANINGS.get(feature, FEATURE_DESCRIPTIONS.get(feature, "")),
        }
        for feature in feature_columns
    ]
    rows.append({
        "field": target_column,
        "role": "目标",
        "meaning": FIELD_MEANINGS.get(target_column, "预测目标"),
    })
    return rows


def custom_dataset(dataset_id: str) -> dict:
    data = CUSTOM_DATASETS.get(dataset_id)
    if not data:
        raise ValueError("学生数据集不存在，请重新上传 CSV。")
    return data


def standardized_col(feature: str) -> str:
    return feature


def standardize_feature_frame(raw: pd.DataFrame, features: list[str], target: str) -> tuple[pd.DataFrame, list[dict]]:
    cleaned = clean_numeric_df(raw, features + [target])
    if len(cleaned) < 2:
        raise ValueError("Dataset needs at least two valid numeric rows.")
    std = cleaned.copy()
    table = []
    for column in features + [target]:
        mean = float(cleaned[column].mean())
        sigma = float(cleaned[column].std(ddof=0))
        if sigma == 0:
            raise ValueError(f"Column {column} has zero standard deviation.")
        std[column] = (cleaned[column] - mean) / sigma
        table.append({
            "feature": column,
            "standardized_feature": column,
            "role": "target" if column == target else "feature",
            "mean": mean,
            "std": sigma,
            "min_before": float(cleaned[column].min()),
            "max_before": float(cleaned[column].max()),
            "min_after": float(std[column].min()),
            "max_after": float(std[column].max()),
        })
    return std, table


def infer_custom_dataset_columns(df: pd.DataFrame) -> tuple[list[str], str]:
    nums = numeric_columns(df)
    if len(nums) < 2:
        raise ValueError("Dataset needs at least one numeric feature column and one numeric target column.")
    target = df.columns[-1]
    if target not in nums:
        raise ValueError("The last CSV column must be a numeric target column.")
    features = [col for col in nums if col != target]
    return features, target


def store_custom_dataset(df: pd.DataFrame, source_type: str = "raw", label: str = "Custom CSV") -> dict:
    if df.empty:
        raise ValueError("Dataset is empty.")
    df = df.copy()
    df.columns = [str(col).strip() for col in df.columns]
    features, target = infer_custom_dataset_columns(df)
    raw = clean_numeric_df(df, features + [target])
    std = raw.copy() if source_type == "standardized" else None
    table = []
    if source_type != "standardized":
        std, table = standardize_feature_frame(raw, features, target)
    dataset_id = uuid4().hex
    CUSTOM_DATASETS[dataset_id] = {
        "raw": raw,
        "std": std,
        "source_type": source_type,
        "features": features,
        "target": target,
        "label": label,
        "standardize_table": table,
    }
    return dataset_metadata(dataset_id)


def dataset_metadata(dataset_id: str = "boston_housing") -> dict:
    if not dataset_id or dataset_id == "boston_housing":
        raw = load_raw_df()
        return {
            "dataset_id": "boston_housing",
            "dataset_kind": "builtin",
            "label": "Boston Housing 原始数据集",
            "source_type": "raw",
            "standardized_ready": True,
            "row_count": int(len(raw)),
            "columns": raw.columns.tolist(),
            "numeric_columns": FEATURE_COLUMNS + [TARGET_COLUMN],
            "target": TARGET_COLUMN,
            "features": FEATURE_COLUMNS,
            "preview_columns": raw.columns.tolist(),
            "preview": preview_records(raw, raw.columns.tolist()),
        }
    data = custom_dataset(dataset_id)
    raw = data["raw"]
    return {
        "dataset_id": dataset_id,
        "dataset_kind": "custom",
        "label": data.get("label") or "Custom CSV",
        "source_type": data.get("source_type", "raw"),
        "standardized_ready": data.get("std") is not None,
        "row_count": int(len(raw)),
        "columns": raw.columns.tolist(),
        "numeric_columns": numeric_columns(raw),
        "target": data.get("target") or raw.columns[-1],
        "features": data.get("features") or [col for col in numeric_columns(raw) if col != raw.columns[-1]],
        "preview_columns": raw.columns.tolist(),
        "preview": preview_records(raw, raw.columns.tolist()),
    }


def load_dataset(payload: dict) -> dict:
    source = payload.get("source", "boston_housing")
    if source == "boston_housing":
        return dataset_metadata("boston_housing")
    raise ValueError(f"Unknown dataset source: {source}")


def dataset_frames(dataset_id: str | None) -> tuple[pd.DataFrame, pd.DataFrame | None, list[str], str, str, str]:
    if not dataset_id or dataset_id == "boston_housing":
        return load_raw_df(), load_std_df(), FEATURE_COLUMNS, TARGET_COLUMN, "boston_housing", "Boston Housing"
    data = custom_dataset(dataset_id)
    raw = data["raw"]
    features = data.get("features")
    target = data.get("target")
    if not features or not target:
        features, target = infer_custom_dataset_columns(raw)
        data["features"] = features
        data["target"] = target
    if data.get("std") is None:
        data["std"], data["standardize_table"] = standardize_feature_frame(raw, features, target)
    return raw, data.get("std"), features, target, dataset_id, data.get("label") or "Custom CSV"


def custom_data_response(
    raw: pd.DataFrame,
    std: pd.DataFrame,
    feature_columns: list[str],
    target_column: str,
    feature: str,
) -> dict:
    y = raw[target_column].astype(float)
    x_raw = raw[feature].astype(float)
    std_col = standardized_col(feature)
    if std is None or std_col not in std.columns:
        x_std = ((x_raw - x_raw.mean()) / x_raw.std(ddof=0)).astype(float)
    else:
        x_std = std[std_col].astype(float)
    y_std = std[target_column].astype(float) if std is not None and target_column in std.columns else ((y - y.mean()) / y.std(ddof=0)).astype(float)
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
            "scatter": {"x": x_std.round(6).tolist(), "y": y_std.round(6).tolist()},
            "trend_line": trend_line(x_std.to_numpy(), y_std.to_numpy()),
            "summary": series_summary(x_std, y_std),
        },
        "correlations": all_correlations_for(raw, feature_columns, target_column),
        "standardize_table": [
            {
                "feature": col,
                "standardized_feature": standardized_col(col),
                "mean": float(raw[col].mean()),
                "std": float(raw[col].std(ddof=0)),
                "min_before": float(raw[col].min()),
                "max_before": float(raw[col].max()),
                "min_after": float(std[standardized_col(col)].min()) if std is not None and standardized_col(col) in std.columns else None,
                "max_after": float(std[standardized_col(col)].max()) if std is not None and standardized_col(col) in std.columns else None,
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
    y_std = std[TARGET_COLUMN].astype(float)
    x_raw = raw[feature].astype(float)
    std_col = feature
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
            "scatter": {"x": x_std.round(6).tolist(), "y": y_std.round(6).tolist()},
            "trend_line": trend_line(x_std.to_numpy(), y_std.to_numpy()),
            "summary": series_summary(x_std, y_std),
        },
        "correlations": all_correlations(raw),
        "standardize_table": [
            {
                "feature": col,
                "standardized_feature": col,
                "mean": float(raw[col].mean()),
                "std": float(raw[col].std(ddof=0)),
                "min_before": float(raw[col].min()),
                "max_before": float(raw[col].max()),
                "min_after": float(std[col].min()),
                "max_after": float(std[col].max()),
            }
            for col in FEATURE_COLUMNS + [TARGET_COLUMN]
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
    x_col = feature
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


def upload_dataset(file, source_type: str = "raw") -> dict:
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
    CUSTOM_DATASETS[dataset_id] = {
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



def prepare_data_view(payload: dict) -> dict:
    dataset_id = payload.get("dataset_id") or "boston_housing"
    raw, std, features, target, resolved_dataset_id, dataset_label = dataset_frames(dataset_id)
    feature = payload.get("feature") or (features[0] if features else "RM")
    if feature not in features:
        raise ValueError(f"Unknown feature: {feature}")

    if resolved_dataset_id == "boston_housing":
        y = raw[target].astype(float)
        x_raw = raw[feature].astype(float)
        std_col = feature
        x_std = std[std_col].astype(float)
        y_std = std[target].astype(float)
        response = {
            "feature": feature,
            "target": target,
            "description": FEATURE_DESCRIPTIONS.get(feature, ""),
            "raw": {
                "scatter": {"x": x_raw.round(6).tolist(), "y": y.round(6).tolist()},
                "trend_line": trend_line(x_raw.to_numpy(), y.to_numpy()),
                "summary": series_summary(x_raw, y),
            },
            "standardized": {
                "feature_name": std_col,
                "scatter": {"x": x_std.round(6).tolist(), "y": y_std.round(6).tolist()},
                "trend_line": trend_line(x_std.to_numpy(), y_std.to_numpy()),
                "summary": series_summary(x_std, y_std),
            },
            "correlations": all_correlations(raw),
            "standardize_table": [
                {
                    "feature": col,
                    "standardized_feature": col,
                    "mean": float(raw[col].mean()),
                    "std": float(raw[col].std(ddof=0)),
                    "min_before": float(raw[col].min()),
                    "max_before": float(raw[col].max()),
                    "min_after": float(std[col].min()),
                    "max_after": float(std[col].max()),
                }
                for col in features + [target]
            ],
        }
    else:
        response = custom_data_response(raw, std, features, target, feature)

    standard_preview_cols = []
    for col in [feature, target]:
        if std is not None and col in std.columns and col not in standard_preview_cols:
            standard_preview_cols.append(col)
    raw_preview_cols = [col for col in [feature, target] if col in raw.columns]
    response.update({
        "dataset_id": resolved_dataset_id,
        "dataset_label": dataset_label,
        "features": features,
        "columns": raw.columns.tolist(),
        "data_quality": dataset_quality(raw),
        "statistical_summary": statistical_summary(raw, features + [target]),
        "data_dictionary": data_dictionary(features, target),
        "raw_preview": preview_records(raw, raw_preview_cols, limit=5) if raw_preview_cols else [],
        "standardized_preview": preview_records(std, standard_preview_cols, limit=5) if std is not None and standard_preview_cols else [],
    })
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
    dataset_id = payload.get("dataset_id") or "boston_housing"
    raw, std, features, target, resolved_dataset_id, dataset_label = dataset_frames(dataset_id)
    feature = payload.get("feature") or (features[0] if features else "RM")
    if feature not in features:
        raise ValueError(f"Unknown feature: {feature}")

    use_standardized = bool(payload.get("use_standardized", True))
    lr = safe_float(payload.get("learning_rate"), 0.03)
    epochs = safe_int(payload.get("epochs"), 120, lo=1, hi=2000)
    w0 = safe_float(payload.get("w0"), 0.0)
    b0 = safe_float(payload.get("b0"), 0.0)

    x_col = feature
    df_train = std if use_standardized else raw
    if df_train is None or x_col not in df_train.columns:
        raise ValueError(f"Missing training column: {x_col}")

    x = df_train[x_col].astype(float).to_numpy()
    y = df_train[target].astype(float).to_numpy()
    w_ref, b_ref = np.polyfit(x, y, 1)
    line_x = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    history = build_training_history(x, y, w0, b0, lr, epochs)
    contour = build_contour(x, y, history, float(w_ref), float(b_ref))

    context = {
        "dataset_id": resolved_dataset_id,
        "dataset_label": dataset_label,
        "feature_columns": features,
        "feature": feature,
        "x_column": x_col,
        "target": target,
        "use_standardized": use_standardized,
        "description": FEATURE_DESCRIPTIONS.get(feature, "") if resolved_dataset_id == "boston_housing" else "",
        "learning_rate": lr,
        "epochs": epochs,
        "scatter": {"x": np.round(x, 6).tolist(), "y": np.round(y, 6).tolist()},
        "line_x": np.round(line_x, 6).tolist(),
        "history": history,
        "best": {"w": float(w_ref), "b": float(b_ref)},
        "contour": contour,
    }
    return create_training_context(context)


def predict(payload: dict) -> dict:
    train_context_id = payload.get("train_context_id")
    if not train_context_id:
        raise ValueError("Missing train_context_id.")
    train_context = get_context(train_context_id)
    history = train_context.get("history") or []
    if not history:
        raise ValueError("Training context has no history.")

    frame_index = safe_int(payload.get("train_frame_index"), len(history) - 1, lo=0, hi=len(history) - 1)
    frame = history[frame_index]
    dataset_id = train_context.get("dataset_id") or "boston_housing"
    raw, std, features, target, resolved_dataset_id, dataset_label = dataset_frames(dataset_id)
    feature = train_context["feature"]
    value = safe_float(payload.get("value"), 6.5)
    input_mode = payload.get("input_mode", "raw")
    if input_mode not in {"raw", "standardized"}:
        raise ValueError("input_mode must be raw or standardized.")

    use_standardized = bool(train_context["use_standardized"])
    if input_mode == "standardized" and not use_standardized:
        raise ValueError("The current model was trained with raw features.")

    x_col = train_context["x_column"]
    df_train = std if use_standardized else raw
    if df_train is None or x_col not in df_train.columns:
        raise ValueError(f"Missing prediction column: {x_col}")

    if use_standardized:
        mean = float(raw[feature].mean())
        sigma = float(raw[feature].std(ddof=0))
        if input_mode == "standardized":
            model_x = value
            raw_value = value * sigma + mean
        else:
            raw_value = value
            model_x = (value - mean) / sigma
    else:
        mean = None
        sigma = None
        raw_value = value
        model_x = value

    x = df_train[x_col].astype(float).to_numpy()
    y = df_train[target].astype(float).to_numpy()
    w = float(frame["w"])
    b = float(frame["b"])
    pred = float(w * model_x + b)
    line_x = np.linspace(float(np.min(x)), float(np.max(x)), 160)
    line_y = w * line_x + b
    raw_x = raw[feature].astype(float).to_numpy()
    distances = np.abs(raw_x - raw_value)
    nearest_idx = np.argsort(distances)[:5]
    nearby = [{
        "index": int(idx),
        "raw_x": float(raw_x[idx]),
        "model_x": float(x[idx]),
        "y": float(y[idx]),
        "distance": float(distances[idx]),
    } for idx in nearest_idx]
    model_state = {
        "train_context_id": train_context_id,
        "train_frame_index": frame_index,
        "source": "train_eval_current",
        "source_label": f"Current model epoch {frame['epoch']}",
        "feature": feature,
        "target": target,
        "x_column": x_col,
        "use_standardized": use_standardized,
        "w": w,
        "b": b,
        "epoch": int(frame["epoch"]),
        "learning_rate": train_context.get("learning_rate"),
        "dataset_id": resolved_dataset_id,
        "dataset_label": dataset_label,
    }
    response = {
        "dataset_id": resolved_dataset_id,
        "dataset_label": dataset_label,
        "feature": feature,
        "description": train_context.get("description", ""),
        "target": target,
        "x_column": x_col,
        "raw_value": float(raw_value),
        "input_value": value,
        "input_mode": input_mode,
        "model_x": float(model_x),
        "use_standardized": use_standardized,
        "mean": mean,
        "std": sigma,
        "w": w,
        "b": b,
        "model_state": model_state,
        "model_source": model_state["source_label"],
        "train_context_id": train_context_id,
        "train_frame_index": frame_index,
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


JSON_ACTIONS = {
    "load_dataset": load_dataset,
    "data_view": prepare_data_view,
    "prepare_train": prepare_train,
    "train_prepare": prepare_train,
    "predict": predict,
}
